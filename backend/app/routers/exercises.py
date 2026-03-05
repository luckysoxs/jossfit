from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.get("", response_model=list[ExerciseResponse])
def list_exercises(
    muscle_group: str | None = Query(None),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Exercise)
    if muscle_group:
        query = query.filter(Exercise.muscle_group == muscle_group)
    if category:
        query = query.filter(Exercise.category == category)
    return query.order_by(Exercise.name).all()
