from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.schemas.routine import RoutineCreate, RoutineExerciseCreate, RoutineExerciseUpdate, RoutineResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/routines", tags=["Routines"])


class RoutineUpdate(BaseModel):
    name: str | None = None


# ──────────────────────────────────────────────────────
# IMPORTANT: Static / sub-path routes MUST come BEFORE
# parameterised /{routine_id} routes, otherwise FastAPI
# matches the literal path segment against {routine_id}
# and returns 422 because e.g. "reorder-exercises" is
# not a valid integer.
# ──────────────────────────────────────────────────────


@router.post("", response_model=RoutineResponse, status_code=201)
def create_routine(
    data: RoutineCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = Routine(
        user_id=user.id,
        name=data.name,
        split_type=data.split_type,
        objective=data.objective,
        days_per_week=data.days_per_week,
    )
    db.add(routine)
    db.flush()

    for day_data in data.days:
        day = RoutineDay(
            routine_id=routine.id,
            day_number=day_data.day_number,
            name=day_data.name,
            focus=day_data.focus,
        )
        db.add(day)
        db.flush()

        for ex_data in day_data.exercises:
            ex = RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex_data.exercise_id,
                order=ex_data.order,
                sets=ex_data.sets,
                reps_min=ex_data.reps_min,
                reps_max=ex_data.reps_max,
                rest_seconds=ex_data.rest_seconds,
                notes=ex_data.notes,
            )
            db.add(ex)

    db.commit()
    db.refresh(routine)
    return _load_full_routine(db, routine.id)


@router.get("", response_model=list[RoutineResponse])
def list_routines(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Routine)
        .filter(Routine.user_id == user.id)
        .options(
            joinedload(Routine.days)
            .joinedload(RoutineDay.exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .order_by(Routine.created_at.desc())
        .all()
    )


# ─── Static PUT routes (before /{routine_id}) ───

@router.put("/reorder-days", status_code=200)
def reorder_days(
    routine_id: int = Body(...),
    day_order: list[int] = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reorder days in a routine. day_order is a list of day IDs in the new order."""
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    days = db.query(RoutineDay).filter(RoutineDay.routine_id == routine_id).all()
    day_map = {d.id: d for d in days}

    for new_number, day_id in enumerate(day_order, start=1):
        if day_id in day_map:
            day_map[day_id].day_number = new_number

    db.commit()
    return {"ok": True}


@router.put("/reorder-exercises", status_code=200)
def reorder_exercises(
    day_id: int = Body(...),
    exercise_order: list[int] = Body(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reorder exercises within a day. exercise_order is a list of RoutineExercise IDs in the new order."""
    day = (
        db.query(RoutineDay)
        .join(Routine)
        .filter(RoutineDay.id == day_id, Routine.user_id == user.id)
        .first()
    )
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    exercises = db.query(RoutineExercise).filter(RoutineExercise.routine_day_id == day_id).all()
    ex_map = {e.id: e for e in exercises}

    for new_order, ex_id in enumerate(exercise_order, start=1):
        if ex_id in ex_map:
            ex_map[ex_id].order = new_order

    db.commit()
    return {"ok": True}


# ─── /exercises/ sub-path routes (before /{routine_id}) ───

@router.put("/exercises/{routine_exercise_id}", status_code=200)
def update_exercise(
    routine_exercise_id: int,
    data: RoutineExerciseUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update sets, reps, rest_seconds for a routine exercise."""
    routine_ex = (
        db.query(RoutineExercise)
        .join(RoutineDay)
        .join(Routine)
        .filter(RoutineExercise.id == routine_exercise_id, Routine.user_id == user.id)
        .first()
    )
    if not routine_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    for field in ("sets", "reps_min", "reps_max", "rest_seconds", "notes"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(routine_ex, field, val)

    db.commit()
    return {"ok": True}


@router.put("/exercises/{routine_exercise_id}/swap", status_code=200)
def swap_exercise(
    routine_exercise_id: int,
    new_exercise_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Find the RoutineExercise and verify ownership
    routine_ex = (
        db.query(RoutineExercise)
        .join(RoutineDay)
        .join(Routine)
        .filter(RoutineExercise.id == routine_exercise_id, Routine.user_id == user.id)
        .first()
    )
    if not routine_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")

    # Verify new exercise exists
    from app.models.exercise import Exercise
    new_ex = db.query(Exercise).filter(Exercise.id == new_exercise_id).first()
    if not new_ex:
        raise HTTPException(status_code=404, detail="New exercise not found")

    routine_ex.exercise_id = new_exercise_id
    db.commit()
    return {"ok": True, "new_exercise_id": new_exercise_id}


@router.delete("/exercises/{routine_exercise_id}", status_code=204)
def delete_exercise(
    routine_exercise_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine_ex = (
        db.query(RoutineExercise)
        .join(RoutineDay)
        .join(Routine)
        .filter(RoutineExercise.id == routine_exercise_id, Routine.user_id == user.id)
        .first()
    )
    if not routine_ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    db.delete(routine_ex)
    db.commit()


@router.post("/days/{routine_day_id}/exercises", status_code=201)
def add_exercise(
    routine_day_id: int,
    data: RoutineExerciseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    day = (
        db.query(RoutineDay)
        .join(Routine)
        .filter(RoutineDay.id == routine_day_id, Routine.user_id == user.id)
        .first()
    )
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    # Prevent duplicate exercise in the same day
    already = (
        db.query(RoutineExercise)
        .filter(
            RoutineExercise.routine_day_id == day.id,
            RoutineExercise.exercise_id == data.exercise_id,
        )
        .first()
    )
    if already:
        raise HTTPException(status_code=409, detail="Este ejercicio ya está en este día")

    ex = RoutineExercise(
        routine_day_id=day.id,
        exercise_id=data.exercise_id,
        order=data.order,
        sets=data.sets,
        reps_min=data.reps_min,
        reps_max=data.reps_max,
        rest_seconds=data.rest_seconds,
        notes=data.notes,
    )
    db.add(ex)
    db.commit()
    return {"ok": True}


# ─── Parameterised /{routine_id} routes (MUST be last) ───

@router.put("/{routine_id}/schedule")
def update_schedule(
    routine_id: int,
    rest_weekdays: list[int] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set rest weekdays for a routine. 0=Monday, 6=Sunday."""
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    # Validate: rest days should leave enough training days
    training_days_available = 7 - len(rest_weekdays)
    if training_days_available < routine.days_per_week:
        raise HTTPException(status_code=400, detail="Demasiados días de descanso para tu rutina")
    routine.rest_weekdays = rest_weekdays
    db.commit()
    return {"ok": True, "rest_weekdays": rest_weekdays}


@router.put("/{routine_id}", response_model=RoutineResponse)
def update_routine(
    routine_id: int,
    data: RoutineUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    if data.name and data.name.strip():
        routine.name = data.name.strip()
    db.commit()
    return _load_full_routine(db, routine.id)


@router.get("/{routine_id}", response_model=RoutineResponse)
def get_routine(
    routine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = _load_full_routine(db, routine_id)
    if not routine or routine.user_id != user.id:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = db.query(Routine).filter(Routine.id == routine_id, Routine.user_id == user.id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")
    db.delete(routine)
    db.commit()


# ─── Helper ───

def _load_full_routine(db: Session, routine_id: int) -> Routine | None:
    return (
        db.query(Routine)
        .filter(Routine.id == routine_id)
        .options(
            joinedload(Routine.days)
            .joinedload(RoutineDay.exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .first()
    )
