from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User
from app.models.note import Note
from app.models.notification import Notification
from app.auth.security import get_current_user
from app.services.push_service import send_push_to_all

router = APIRouter(prefix="/notes", tags=["Notes"])


class NoteCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    scheduled_at: str | None = None  # ISO datetime string or null


class NoteResponse(BaseModel):
    id: int
    admin_id: int
    title: str
    content: str
    category: str
    scheduled_at: str | None = None
    updated_at: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


def _get_admin(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("", response_model=list[NoteResponse])
def list_notes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    if user.is_admin:
        # Admins see all notes (including future scheduled)
        return db.query(Note).order_by(Note.created_at.desc()).all()
    # Regular users only see published notes (no scheduled_at or scheduled_at <= now)
    return (
        db.query(Note)
        .filter(or_(Note.scheduled_at.is_(None), Note.scheduled_at <= now))
        .order_by(Note.created_at.desc())
        .all()
    )


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


@router.post("", response_model=NoteResponse, status_code=201)
def create_note(
    data: NoteCreate,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    scheduled = None
    if data.scheduled_at:
        try:
            scheduled = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    note = Note(
        admin_id=admin.id,
        title=data.title,
        content=data.content,
        category=data.category,
        scheduled_at=scheduled,
    )
    db.add(note)
    db.flush()

    # Only notify immediately if not scheduled for the future
    if not scheduled or scheduled <= datetime.utcnow():
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
        send_push_to_all(db, f"Nueva nota: {data.title}", data.content[:100], f"/notes/{note.id}")
    else:
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
    note.updated_at = datetime.utcnow()
    if data.scheduled_at:
        try:
            note.scheduled_at = datetime.fromisoformat(data.scheduled_at.replace("Z", "+00:00"))
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
