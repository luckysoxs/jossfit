import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.note_view import NoteView
from app.models.notification import Notification
from app.auth.security import get_current_user
from app.services.push_service import send_push_to_all

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["Notes"])


class NoteCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    scheduled_at: str | None = None  # ISO datetime string or null
    send_push: bool = True  # Whether to send push notification


class NoteResponse(BaseModel):
    id: int
    admin_id: int
    title: str
    content: str
    category: str
    scheduled_at: datetime | None = None
    published: bool = False
    send_push: bool = True
    updated_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ViewCreate(BaseModel):
    read_seconds: int = 0


class ViewUpdate(BaseModel):
    read_seconds: int


def _get_admin(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("", response_model=list[NoteResponse])
def list_notes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.is_admin:
        # Admins see all notes (including unpublished/scheduled)
        return db.query(Note).order_by(Note.created_at.desc()).all()
    # Regular users only see published notes
    return (
        db.query(Note)
        .filter(Note.published == True)
        .order_by(Note.created_at.desc())
        .all()
    )


# ── Analytics endpoints (must be before /{note_id} to avoid path conflict) ──

@router.get("/all-stats")
def all_notes_stats(
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    """Bulk stats for all notes — avoids N+1 requests."""
    rows = (
        db.query(
            NoteView.note_id,
            sqlfunc.count(NoteView.id).label("total_opens"),
            sqlfunc.count(sqlfunc.distinct(NoteView.user_id)).label("unique_readers"),
            sqlfunc.coalesce(
                sqlfunc.avg(
                    sqlfunc.nullif(NoteView.read_seconds, 0)
                ),
                0,
            ).label("avg_read_seconds"),
        )
        .group_by(NoteView.note_id)
        .all()
    )
    result = {}
    for note_id, total_opens, unique_readers, avg_secs in rows:
        result[str(note_id)] = {
            "total_opens": total_opens,
            "unique_readers": unique_readers,
            "avg_read_seconds": round(float(avg_secs)),
        }
    return result


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(
    note_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return note


@router.get("/{note_id}/stats")
def note_stats(
    note_id: int,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    """Per-note detailed stats with reader breakdown."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    total_opens = db.query(sqlfunc.count(NoteView.id)).filter(NoteView.note_id == note_id).scalar() or 0
    unique_readers = db.query(sqlfunc.count(sqlfunc.distinct(NoteView.user_id))).filter(NoteView.note_id == note_id).scalar() or 0
    avg_secs = (
        db.query(sqlfunc.avg(NoteView.read_seconds))
        .filter(NoteView.note_id == note_id, NoteView.read_seconds > 0)
        .scalar()
    )

    # Reader breakdown
    reader_rows = (
        db.query(
            NoteView.user_id,
            User.name,
            sqlfunc.count(NoteView.id).label("opens"),
            sqlfunc.sum(NoteView.read_seconds).label("total_seconds"),
            sqlfunc.max(NoteView.opened_at).label("last_opened"),
        )
        .join(User, User.id == NoteView.user_id)
        .filter(NoteView.note_id == note_id)
        .group_by(NoteView.user_id, User.name)
        .order_by(sqlfunc.max(NoteView.opened_at).desc())
        .all()
    )

    readers = [
        {
            "user_id": uid,
            "user_name": name,
            "opens": opens,
            "total_seconds": int(total_secs or 0),
            "last_opened": str(last_opened) if last_opened else None,
        }
        for uid, name, opens, total_secs, last_opened in reader_rows
    ]

    return {
        "total_opens": total_opens,
        "unique_readers": unique_readers,
        "avg_read_seconds": round(float(avg_secs)) if avg_secs else 0,
        "readers": readers,
    }


@router.post("/{note_id}/view")
def record_view(
    note_id: int,
    data: ViewCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that a user opened a note."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    view = NoteView(
        note_id=note_id,
        user_id=user.id,
        read_seconds=data.read_seconds,
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return {"view_id": view.id}


@router.put("/{note_id}/view/{view_id}")
def update_view(
    note_id: int,
    view_id: int,
    data: ViewUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update read time when user leaves the note."""
    view = db.query(NoteView).filter(
        NoteView.id == view_id,
        NoteView.note_id == note_id,
        NoteView.user_id == user.id,
    ).first()
    if not view:
        raise HTTPException(status_code=404, detail="Vista no encontrada")
    view.read_seconds = data.read_seconds
    db.commit()
    return {"ok": True}


@router.post("", response_model=NoteResponse, status_code=201)
def create_note(
    data: NoteCreate,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    scheduled = None
    if data.scheduled_at:
        try:
            parsed = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
            # Convert to naive UTC for consistent storage & comparison
            if parsed.tzinfo is not None:
                scheduled = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                scheduled = parsed
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    is_immediate = not scheduled or scheduled <= datetime.utcnow()

    note = Note(
        admin_id=admin.id,
        title=data.title,
        content=data.content,
        category=data.category,
        scheduled_at=scheduled,
        published=is_immediate,
        send_push=data.send_push,
    )
    db.add(note)
    db.flush()

    # Only notify immediately if not scheduled for the future
    if is_immediate:
        all_users = db.query(User.id).all()
        for (uid,) in all_users:
            db.add(Notification(
                user_id=uid,
                title=data.title,
                body=f"Nueva nota: {data.title}",
                url=f"/notes/{note.id}",
            ))
        db.commit()
        db.refresh(note)

        # Send push only if enabled — wrapped in try-catch to prevent 500 errors
        if data.send_push:
            try:
                send_push_to_all(db, f"Nueva nota: {data.title}", data.content[:100], f"/notes/{note.id}")
            except Exception as e:
                logger.warning(f"Push notification failed for note #{note.id}: {e}")
    else:
        # Scheduled for the future — the background task will publish it
        db.commit()
        db.refresh(note)

    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteCreate,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    note.title = data.title
    note.content = data.content
    note.category = data.category
    note.send_push = data.send_push
    note.updated_at = datetime.utcnow()
    if data.scheduled_at:
        try:
            parsed = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
            if parsed.tzinfo is not None:
                note.scheduled_at = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                note.scheduled_at = parsed
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    else:
        note.scheduled_at = None
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    db.delete(note)
    db.commit()
