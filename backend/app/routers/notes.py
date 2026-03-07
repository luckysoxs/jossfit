from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

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


class NoteResponse(BaseModel):
    id: int
    admin_id: int
    title: str
    content: str
    category: str
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
    return db.query(Note).order_by(Note.created_at.desc()).all()


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
    note = Note(
        admin_id=admin.id,
        title=data.title,
        content=data.content,
        category=data.category,
    )
    db.add(note)
    db.flush()

    # Create in-app notification for ALL users
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

    # Send push notification to all
    send_push_to_all(db, f"Nueva nota: {data.title}", data.content[:100], f"/notes/{note.id}")

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
