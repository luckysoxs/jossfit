from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.cardio_session import CardioSession
from app.schemas.cardio import CardioSessionCreate, CardioSessionResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/cardio", tags=["Cardio"])


@router.post("", response_model=CardioSessionResponse, status_code=201)
def save_cardio_session(
    data: CardioSessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = CardioSession(user_id=user.id, **data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[CardioSessionResponse])
def list_cardio_sessions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(CardioSession)
        .filter(CardioSession.user_id == user.id)
        .order_by(CardioSession.date.desc())
        .limit(50)
        .all()
    )
