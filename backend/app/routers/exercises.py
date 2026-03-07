from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.schemas.exercise import ExerciseResponse, CreateExerciseRequest, UpdateExerciseRequest
from app.auth.security import get_current_user, get_admin_user

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

    # Check duplicate by name (both name and name_es fields)
    conditions = [
        Exercise.name == req.name,
        Exercise.name_es == req.name,
    ]
    if req.name_es:
        conditions.append(Exercise.name == req.name_es)
        conditions.append(Exercise.name_es == req.name_es)
    existing = db.query(Exercise).filter(or_(*conditions)).first()
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


@router.put("/{exercise_id}", response_model=ExerciseResponse)
def update_exercise(
    exercise_id: int,
    req: UpdateExerciseRequest,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    """Admin: update an exercise."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(404, "Ejercicio no encontrado")

    if req.name is not None:
        # Check duplicate
        dup = db.query(Exercise).filter(
            Exercise.name == req.name, Exercise.id != exercise_id
        ).first()
        if dup:
            raise HTTPException(409, "Ya existe un ejercicio con ese nombre")
        exercise.name = req.name

    if req.name_es is not None:
        exercise.name_es = req.name_es or None

    if req.muscle_group is not None:
        try:
            exercise.muscle_group = MuscleGroup(req.muscle_group)
        except ValueError:
            raise HTTPException(400, f"Grupo muscular inválido: {req.muscle_group}")

    if req.category is not None:
        try:
            exercise.category = ExerciseCategory(req.category)
        except ValueError:
            raise HTTPException(400, f"Categoría inválida: {req.category}")

    if req.secondary_muscles is not None:
        exercise.secondary_muscles = req.secondary_muscles or None

    if req.equipment is not None:
        exercise.equipment = req.equipment or None

    db.commit()
    db.refresh(exercise)
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(
    exercise_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
    """Admin: delete an exercise."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(404, "Ejercicio no encontrado")
    db.delete(exercise)
    db.commit()
