from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.models.one_rep_max import OneRepMax
from app.models.exercise import Exercise
from app.schemas.workout import WorkoutCreate, WorkoutResponse
from app.auth.security import get_current_user
from app.services.algorithms import calculate_1rm_epley, calculate_1rm_brzycki

router = APIRouter(prefix="/workouts", tags=["Workouts"])


@router.post("", response_model=WorkoutResponse, status_code=201)
def log_workout(
    data: WorkoutCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = Workout(
        user_id=user.id,
        routine_day_id=data.routine_day_id,
        date=data.date,
        duration_minutes=data.duration_minutes,
        notes=data.notes,
        fatigue_level=data.fatigue_level,
    )
    db.add(workout)
    db.flush()

    for s in data.sets:
        ws = WorkoutSet(
            workout_id=workout.id,
            exercise_id=s.exercise_id,
            set_number=s.set_number,
            reps=s.reps,
            weight_kg=s.weight_kg,
            rpe=s.rpe,
            completed=s.completed,
            notes=s.notes,
        )
        db.add(ws)

        # Auto-record 1RM if reps <= 10 and completed
        if s.completed and 1 <= s.reps <= 10 and s.weight_kg > 0:
            epley = calculate_1rm_epley(s.weight_kg, s.reps)
            brzycki = calculate_1rm_brzycki(s.weight_kg, s.reps)
            avg = (epley + brzycki) / 2
            orm = OneRepMax(
                user_id=user.id,
                exercise_id=s.exercise_id,
                estimated_1rm=round(avg, 1),
                formula_used="average",
                date=data.date,
                source_weight=s.weight_kg,
                source_reps=s.reps,
            )
            db.add(orm)

    db.commit()
    return _load_workout(db, workout.id)


@router.get("/history", response_model=list[WorkoutResponse])
def workout_history(
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Workout)
        .filter(Workout.user_id == user.id)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .order_by(Workout.date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{workout_id}", response_model=WorkoutResponse)
def get_workout(
    workout_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = _load_workout(db, workout_id)
    if not workout or workout.user_id != user.id:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.delete("/{workout_id}", status_code=204)
def delete_workout(
    workout_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = db.query(Workout).filter(
        Workout.id == workout_id, Workout.user_id == user.id
    ).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    db.delete(workout)
    db.commit()


def _load_workout(db: Session, workout_id: int) -> Workout | None:
    return (
        db.query(Workout)
        .filter(Workout.id == workout_id)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .first()
    )
