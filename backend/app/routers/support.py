"""Support chat endpoints — user ↔ admin messaging with push notifications."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, desc

from app.database import get_db
from app.models.user import User
from app.models.support_message import SupportMessage
from app.schemas.support import (
    SupportMessageCreate,
    SupportMessageResponse,
    ConversationSummary,
)
from app.auth.security import get_current_user, get_admin_user

router = APIRouter(tags=["Support"])


# ─── USER ENDPOINTS ────────────────────────────────────────────────

@router.get("/support/messages", response_model=list[SupportMessageResponse])
def get_my_messages(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == user.id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    # Mark admin messages as read
    db.query(SupportMessage).filter(
        SupportMessage.user_id == user.id,
        SupportMessage.is_from_admin == True,
        SupportMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return messages


@router.post("/support/messages", response_model=SupportMessageResponse, status_code=201)
def send_message(
    data: SupportMessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = SupportMessage(
        user_id=user.id,
        content=data.content.strip(),
        is_from_admin=False,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Push to all admins
    try:
        from app.services.push_service import send_push_to_user

        admins = db.query(User).filter(User.is_admin == True).all()
        for admin in admins:
            send_push_to_user(
                db,
                admin.id,
                f"Mensaje de {user.name}",
                data.content[:100],
                "/admin?tab=chat",
            )
    except Exception:
        pass  # Don't fail the message if push fails

    return msg


@router.get("/support/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(sqlfunc.count(SupportMessage.id))
        .filter(
            SupportMessage.user_id == user.id,
            SupportMessage.is_from_admin == True,
            SupportMessage.is_read == False,
        )
        .scalar()
        or 0
    )
    return {"unread": count}


# ─── ADMIN ENDPOINTS ───────────────────────────────────────────────

@router.get("/admin/support/conversations", response_model=list[ConversationSummary])
def list_conversations(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    # Users who have at least one support message
    latest_sub = (
        db.query(
            SupportMessage.user_id,
            sqlfunc.max(SupportMessage.created_at).label("last_at"),
        )
        .group_by(SupportMessage.user_id)
        .subquery()
    )

    unread_sub = (
        db.query(
            SupportMessage.user_id,
            sqlfunc.count(SupportMessage.id).label("unread"),
        )
        .filter(
            SupportMessage.is_from_admin == False,
            SupportMessage.is_read == False,
        )
        .group_by(SupportMessage.user_id)
        .subquery()
    )

    rows = (
        db.query(User, latest_sub.c.last_at, unread_sub.c.unread)
        .join(latest_sub, User.id == latest_sub.c.user_id)
        .outerjoin(unread_sub, User.id == unread_sub.c.user_id)
        .order_by(desc(latest_sub.c.last_at))
        .all()
    )

    result = []
    for user_obj, last_at, unread in rows:
        last = (
            db.query(SupportMessage)
            .filter(SupportMessage.user_id == user_obj.id)
            .order_by(desc(SupportMessage.created_at))
            .first()
        )
        result.append(
            ConversationSummary(
                user_id=user_obj.id,
                user_name=user_obj.name,
                user_email=user_obj.email,
                last_message=last.content[:80] if last else "",
                last_message_at=last_at,
                unread_count=unread or 0,
            )
        )

    return result


@router.get(
    "/admin/support/conversations/{user_id}",
    response_model=list[SupportMessageResponse],
)
def get_conversation(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(SupportMessage)
        .filter(SupportMessage.user_id == user_id)
        .order_by(SupportMessage.created_at.asc())
        .all()
    )
    # Mark user messages as read
    db.query(SupportMessage).filter(
        SupportMessage.user_id == user_id,
        SupportMessage.is_from_admin == False,
        SupportMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return messages


@router.post(
    "/admin/support/conversations/{user_id}",
    response_model=SupportMessageResponse,
    status_code=201,
)
def admin_reply(
    user_id: int,
    data: SupportMessageCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user_obj = db.query(User).filter(User.id == user_id).first()
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")

    msg = SupportMessage(
        user_id=user_id,
        content=data.content.strip(),
        is_from_admin=True,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Push to the user
    try:
        from app.services.push_service import send_push_to_user

        send_push_to_user(
            db,
            user_id,
            "Respuesta de soporte",
            data.content[:100],
            "/support",
        )
    except Exception:
        pass

    return msg
