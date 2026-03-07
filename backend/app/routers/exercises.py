from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.schemas.exercise import ExerciseResponse, CreateExerciseRequest
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


@router.post("", response_model=ExerciseResponse, status_code=201)
def create_exercise(
    req: CreateExerciseRequest,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Create a custom exercise."""
    # Validate muscle_group
    try:
        mg = MuscleGroup(req.muscle_group)
    except ValueError:
        raise HTTPException(400, f"Grupo muscular inválido: {req.muscle_group}")

    # Validate category
    try:
        cat = ExerciseCategory(req.category)
    except ValueError:
        raise HTTPException(400, f"Categoría inválida: {req.category}")

    # Check duplicate by name
    existing = db.query(Exercise).filter(
        (Exercise.name == req.name) | (Exercise.name_es == req.name)
    ).first()
    if existing:
        raise HTTPException(409, "Ya existe un ejercicio con ese nombre")

    exercise = Exercise(
        name=req.name,
        name_es=req.name_es,
        muscle_group=mg,
        category=cat,
        equipment=req.equipment,
    )
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise
