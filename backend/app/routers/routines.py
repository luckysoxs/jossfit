from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.schemas.routine import RoutineCreate, RoutineExerciseCreate, RoutineExerciseUpdate, RoutineResponse
from app.auth.security import get_current_user
from app.ai.routine_generator import (
    MAX_EXERCISES_PER_DAY, SETS_CONFIG, REP_RANGES, ACCESSORY_MUSCLES,
    _EXERCISE_TO_GROUP, _allocate_exercises,
)

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


class LinkExercisesRequest(BaseModel):
    exercise_ids: list[int]


@router.put("/exercises/link", status_code=200)
def link_exercises(
    data: LinkExercisesRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Link 2+ exercises into a superset (biserie) or circuit."""
    import uuid

    if len(data.exercise_ids) < 2:
        raise HTTPException(status_code=400, detail="Se necesitan al menos 2 ejercicios para enlazar")

    # Fetch all exercises and verify ownership + same day
    exercises = (
        db.query(RoutineExercise)
        .join(RoutineDay)
        .join(Routine)
        .filter(
            RoutineExercise.id.in_(data.exercise_ids),
            Routine.user_id == user.id,
        )
        .all()
    )

    if len(exercises) != len(data.exercise_ids):
        raise HTTPException(status_code=404, detail="Uno o más ejercicios no encontrados")

    day_ids = set(ex.routine_day_id for ex in exercises)
    if len(day_ids) > 1:
        raise HTTPException(status_code=400, detail="Todos los ejercicios deben pertenecer al mismo día")

    day_id = day_ids.pop()
    routine_day = db.query(RoutineDay).filter(RoutineDay.id == day_id).first()

    # Assign group_id
    group_id = str(uuid.uuid4())[:8]
    for ex in exercises:
        ex.group_id = group_id

    # Reorder so grouped exercises are consecutive
    all_day_exercises = (
        db.query(RoutineExercise)
        .filter(RoutineExercise.routine_day_id == day_id)
        .order_by(RoutineExercise.order)
        .all()
    )

    grouped_ids = set(data.exercise_ids)
    first_grouped_order = min(ex.order for ex in exercises)

    # Separate: non-grouped before insertion point, grouped, non-grouped after
    before = [e for e in all_day_exercises if e.id not in grouped_ids and e.order < first_grouped_order]
    grouped = sorted(exercises, key=lambda e: data.exercise_ids.index(e.id))
    after = [e for e in all_day_exercises if e.id not in grouped_ids and e.order >= first_grouped_order]

    new_order = before + grouped + after
    for i, ex in enumerate(new_order, start=1):
        ex.order = i

    db.commit()
    return _load_full_routine(db, routine_day.routine_id)


@router.put("/exercises/{routine_exercise_id}/unlink", status_code=200)
def unlink_exercise(
    routine_exercise_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove an exercise from its superset/circuit group."""
    routine_ex = (
        db.query(RoutineExercise)
        .join(RoutineDay)
        .join(Routine)
        .filter(RoutineExercise.id == routine_exercise_id, Routine.user_id == user.id)
        .first()
    )
    if not routine_ex:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    if not routine_ex.group_id:
        return _load_full_routine(db, routine_ex.routine_day.routine_id)

    old_group_id = routine_ex.group_id
    routine_ex.group_id = None

    # If remaining group has only 1 member, dissolve it
    remaining = (
        db.query(RoutineExercise)
        .filter(
            RoutineExercise.routine_day_id == routine_ex.routine_day_id,
            RoutineExercise.group_id == old_group_id,
        )
        .all()
    )
    if len(remaining) == 1:
        remaining[0].group_id = None

    db.commit()
    return _load_full_routine(db, routine_ex.routine_day.routine_id)


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


@router.post("/days/{routine_day_id}/regenerate", status_code=200)
def regenerate_day_exercises(
    routine_day_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate (randomize) exercises for a routine day, keeping the same
    muscle focus, day name, and config from the parent routine."""
    from sqlalchemy import func as sqlfunc

    day = (
        db.query(RoutineDay)
        .join(Routine)
        .filter(RoutineDay.id == routine_day_id, Routine.user_id == user.id)
        .first()
    )
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    routine = db.query(Routine).filter(Routine.id == day.routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    # Determine training params
    training_level = (
        user.training_level.value
        if hasattr(user.training_level, "value")
        else str(user.training_level)
    )
    objective = routine.objective or "hypertrophy"
    max_ex = MAX_EXERCISES_PER_DAY.get(training_level, 7)
    sets_cfg = SETS_CONFIG.get(training_level, SETS_CONFIG["intermediate"])
    reps = REP_RANGES.get(objective, REP_RANGES["hypertrophy"])

    focus_muscles = [m.strip() for m in (day.focus or "").split(",") if m.strip()]
    if not focus_muscles:
        raise HTTPException(status_code=400, detail="Este día no tiene enfoque muscular definido")

    main_muscles = [m for m in focus_muscles if m not in ACCESSORY_MUSCLES]
    accessory_muscles = [m for m in focus_muscles if m in ACCESSORY_MUSCLES]
    allocation = _allocate_exercises(main_muscles, max_ex) if main_muscles else {}

    # Delete old exercises for this day
    db.query(RoutineExercise).filter(RoutineExercise.routine_day_id == day.id).delete()
    db.flush()

    # Generate new exercises (same logic as routine_generator)
    used_exercise_ids = set()
    used_sim_groups = set()
    order = 1

    for muscle in main_muscles:
        try:
            mg = MuscleGroup(muscle)
        except ValueError:
            continue

        count = allocation.get(muscle, 1)

        compounds = (
            db.query(Exercise)
            .filter(Exercise.muscle_group == mg, Exercise.category == ExerciseCategory.COMPOUND)
            .order_by(sqlfunc.random())
            .all()
        )
        isolations = (
            db.query(Exercise)
            .filter(Exercise.muscle_group == mg, Exercise.category == ExerciseCategory.ISOLATION)
            .order_by(sqlfunc.random())
            .all()
        )

        added = 0
        for ex in compounds:
            if added >= count:
                break
            if ex.id in used_exercise_ids:
                continue
            sim_group = _EXERCISE_TO_GROUP.get(ex.name)
            if sim_group and sim_group in used_sim_groups:
                continue
            base_rest = 120 if objective == "strength" else 90
            db.add(RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex.id,
                order=order,
                sets=sets_cfg["compound"],
                reps_min=reps["compound"][0],
                reps_max=reps["compound"][1],
                rest_seconds=base_rest,
            ))
            used_exercise_ids.add(ex.id)
            if sim_group:
                used_sim_groups.add(sim_group)
            order += 1
            added += 1

        for ex in isolations:
            if added >= count:
                break
            if ex.id in used_exercise_ids:
                continue
            sim_group = _EXERCISE_TO_GROUP.get(ex.name)
            if sim_group and sim_group in used_sim_groups:
                continue
            db.add(RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex.id,
                order=order,
                sets=sets_cfg["isolation"],
                reps_min=reps["isolation"][0],
                reps_max=reps["isolation"][1],
                rest_seconds=60,
            ))
            used_exercise_ids.add(ex.id)
            if sim_group:
                used_sim_groups.add(sim_group)
            order += 1
            added += 1

    # Accessory muscles
    for muscle in accessory_muscles:
        try:
            mg = MuscleGroup(muscle)
        except ValueError:
            continue

        ex = (
            db.query(Exercise)
            .filter(Exercise.muscle_group == mg, ~Exercise.id.in_(used_exercise_ids))
            .order_by(sqlfunc.random())
            .first()
        )
        if not ex:
            ex = db.query(Exercise).filter(Exercise.muscle_group == mg).order_by(sqlfunc.random()).first()
        if not ex:
            continue

        db.add(RoutineExercise(
            routine_day_id=day.id,
            exercise_id=ex.id,
            order=order,
            sets=sets_cfg["isolation"],
            reps_min=reps["isolation"][0],
            reps_max=reps["isolation"][1],
            rest_seconds=60,
        ))
        used_exercise_ids.add(ex.id)
        order += 1

    db.commit()
    return _load_full_routine(db, routine.id)


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
