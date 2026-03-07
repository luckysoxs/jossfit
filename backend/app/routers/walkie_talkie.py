"""Admin walkie-talkie: messaging between admins (DM and group)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, desc

from app.database import get_db
from app.models.user import User
from app.models.admin_chat import AdminChat, AdminChatMember, AdminChatMessage
from app.schemas.walkie_talkie import (
    CreateChatRequest,
    SendMessageRequest,
    UpdateChatRequest,
    ChatListItem,
    ChatMemberResponse,
    ChatMessageResponse,
    UnreadCountResponse,
)
from app.auth.security import get_admin_user

router = APIRouter(prefix="/admin/walkie-talkie", tags=["Walkie-Talkie"])


# ─── helpers ────────────────────────────────────────────────

def _unread_count(db: Session, chat_id: int, user_id: int, last_read_at) -> int:
    q = db.query(sqlfunc.count(AdminChatMessage.id)).filter(
        AdminChatMessage.chat_id == chat_id,
        AdminChatMessage.sender_id != user_id,
    )
    if last_read_at:
        q = q.filter(AdminChatMessage.created_at > last_read_at)
    return q.scalar() or 0


# ─── GET /chats ─────────────────────────────────────────────

@router.get("/chats", response_model=list[ChatListItem])
def list_chats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(AdminChatMember)
        .filter(AdminChatMember.user_id == admin.id)
        .all()
    )

    result = []
    for membership in memberships:
        chat = db.query(AdminChat).filter(AdminChat.id == membership.chat_id).first()
        if not chat:
            continue

        # Members with names
        members_rows = (
            db.query(AdminChatMember, User)
            .join(User, AdminChatMember.user_id == User.id)
            .filter(AdminChatMember.chat_id == chat.id)
            .all()
        )
        members = [
            ChatMemberResponse(user_id=u.id, user_name=u.name)
            for _, u in members_rows
        ]

        # Last message
        last_msg = (
            db.query(AdminChatMessage)
            .filter(AdminChatMessage.chat_id == chat.id)
            .order_by(desc(AdminChatMessage.created_at))
            .first()
        )

        unread = _unread_count(db, chat.id, admin.id, membership.last_read_at)

        result.append(
            ChatListItem(
                id=chat.id,
                name=chat.name,
                is_group=chat.is_group,
                members=members,
                last_message=last_msg.content[:80] if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else None,
                unread_count=unread,
            )
        )

    # Sort by most recent activity
    result.sort(
        key=lambda c: c.last_message_at or datetime.min,
        reverse=True,
    )
    return result


# ─── POST /chats ────────────────────────────────────────────

@router.post("/chats", status_code=201)
def create_chat(
    data: CreateChatRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if data.recipient_id:
        # ── DM ──
        recipient = (
            db.query(User)
            .filter(User.id == data.recipient_id, User.is_admin == True)
            .first()
        )
        if not recipient:
            raise HTTPException(404, "Admin user not found")
        if data.recipient_id == admin.id:
            raise HTTPException(400, "Cannot DM yourself")

        # Check existing DM
        my_chats = (
            db.query(AdminChatMember.chat_id)
            .filter(AdminChatMember.user_id == admin.id)
            .subquery()
        )
        existing = (
            db.query(AdminChat.id)
            .join(AdminChatMember, AdminChat.id == AdminChatMember.chat_id)
            .filter(
                AdminChat.is_group == False,
                AdminChat.id.in_(db.query(my_chats.c.chat_id)),
                AdminChatMember.user_id == data.recipient_id,
            )
            .first()
        )
        if existing:
            return {"id": existing[0], "existing": True}

        chat = AdminChat(is_group=False, created_by=admin.id)
        db.add(chat)
        db.flush()
        db.add(AdminChatMember(chat_id=chat.id, user_id=admin.id))
        db.add(AdminChatMember(chat_id=chat.id, user_id=data.recipient_id))
        db.commit()
        return {"id": chat.id, "existing": False}

    elif data.name and data.member_ids:
        # ── Group ──
        member_ids = list(set(data.member_ids + [admin.id]))
        admins = (
            db.query(User)
            .filter(User.id.in_(member_ids), User.is_admin == True)
            .all()
        )
        if len(admins) != len(member_ids):
            raise HTTPException(400, "All members must be admins")
        if len(member_ids) < 2:
            raise HTTPException(400, "Group needs at least 2 members")

        chat = AdminChat(name=data.name, is_group=True, created_by=admin.id)
        db.add(chat)
        db.flush()
        for uid in member_ids:
            db.add(AdminChatMember(chat_id=chat.id, user_id=uid))
        db.commit()
        return {"id": chat.id, "existing": False}

    else:
        raise HTTPException(
            400, "Provide recipient_id for DM or name + member_ids for group"
        )


# ─── GET /chats/{chat_id}/messages ──────────────────────────

@router.get("/chats/{chat_id}/messages", response_model=list[ChatMessageResponse])
def get_messages(
    chat_id: int,
    limit: int = Query(50, le=200),
    before_id: int | None = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(AdminChatMember)
        .filter(
            AdminChatMember.chat_id == chat_id,
            AdminChatMember.user_id == admin.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(403, "Not a member of this chat")

    query = (
        db.query(AdminChatMessage, User.name)
        .join(User, AdminChatMessage.sender_id == User.id)
        .filter(AdminChatMessage.chat_id == chat_id)
    )
    if before_id:
        query = query.filter(AdminChatMessage.id < before_id)

    rows = query.order_by(desc(AdminChatMessage.created_at)).limit(limit).all()

    return [
        ChatMessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender_id=msg.sender_id,
            sender_name=name,
            content=msg.content,
            created_at=msg.created_at,
        )
        for msg, name in reversed(rows)
    ]


# ─── POST /chats/{chat_id}/messages ─────────────────────────

@router.post(
    "/chats/{chat_id}/messages",
    response_model=ChatMessageResponse,
    status_code=201,
)
def send_message(
    chat_id: int,
    data: SendMessageRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(AdminChatMember)
        .filter(
            AdminChatMember.chat_id == chat_id,
            AdminChatMember.user_id == admin.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(403, "Not a member of this chat")

    msg = AdminChatMessage(
        chat_id=chat_id,
        sender_id=admin.id,
        content=data.content.strip(),
    )
    db.add(msg)
    membership.last_read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)

    # Push notification to other members
    try:
        from app.services.push_service import send_push_to_user

        other_members = (
            db.query(AdminChatMember.user_id)
            .filter(
                AdminChatMember.chat_id == chat_id,
                AdminChatMember.user_id != admin.id,
            )
            .all()
        )
        chat = db.query(AdminChat).filter(AdminChat.id == chat_id).first()
        title = f"📻 {admin.name}"
        if chat and chat.is_group and chat.name:
            title = f"📻 {chat.name}: {admin.name}"

        for (uid,) in other_members:
            send_push_to_user(
                db, uid, title,
                data.content[:100],
                "/admin/walkie-talkie",
            )
    except Exception:
        pass

    return ChatMessageResponse(
        id=msg.id,
        chat_id=msg.chat_id,
        sender_id=msg.sender_id,
        sender_name=admin.name,
        content=msg.content,
        created_at=msg.created_at,
    )


# ─── PUT /chats/{chat_id}/read ──────────────────────────────

@router.put("/chats/{chat_id}/read")
def mark_read(
    chat_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    membership = (
        db.query(AdminChatMember)
        .filter(
            AdminChatMember.chat_id == chat_id,
            AdminChatMember.user_id == admin.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(403, "Not a member")

    membership.last_read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ─── PUT /chats/{chat_id} ───────────────────────────────────

@router.put("/chats/{chat_id}")
def update_chat(
    chat_id: int,
    data: UpdateChatRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    chat = db.query(AdminChat).filter(AdminChat.id == chat_id).first()
    if not chat or not chat.is_group:
        raise HTTPException(404, "Group chat not found")

    membership = (
        db.query(AdminChatMember)
        .filter(
            AdminChatMember.chat_id == chat_id,
            AdminChatMember.user_id == admin.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(403, "Not a member")

    if data.name is not None:
        chat.name = data.name

    if data.add_member_ids:
        for uid in data.add_member_ids:
            user = (
                db.query(User)
                .filter(User.id == uid, User.is_admin == True)
                .first()
            )
            if not user:
                continue
            exists = (
                db.query(AdminChatMember)
                .filter(
                    AdminChatMember.chat_id == chat_id,
                    AdminChatMember.user_id == uid,
                )
                .first()
            )
            if not exists:
                db.add(AdminChatMember(chat_id=chat_id, user_id=uid))

    if data.remove_member_ids:
        for uid in data.remove_member_ids:
            if uid == admin.id:
                continue
            db.query(AdminChatMember).filter(
                AdminChatMember.chat_id == chat_id,
                AdminChatMember.user_id == uid,
            ).delete()

    db.commit()
    return {"ok": True}


# ─── GET /unread ─────────────────────────────────────────────

@router.get("/unread", response_model=UnreadCountResponse)
def get_total_unread(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    memberships = (
        db.query(AdminChatMember)
        .filter(AdminChatMember.user_id == admin.id)
        .all()
    )

    total = 0
    for m in memberships:
        total += _unread_count(db, m.chat_id, admin.id, m.last_read_at)

    return UnreadCountResponse(unread=total)


# ─── GET /admins ─────────────────────────────────────────────

@router.get("/admins")
def list_admins(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all admin users for creating new chats."""
    admins = db.query(User).filter(User.is_admin == True).all()
    return [
        {"id": a.id, "name": a.name, "email": a.email}
        for a in admins
        if a.id != admin.id
    ]
