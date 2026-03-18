from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.models.one_rep_max import OneRepMax
from app.models.exercise import Exercise
from app.schemas.workout import WorkoutCreate, WorkoutResponse
from app.auth.security import get_current_user
from app.services.algorithms import calculate_1rm_epley, calculate_1rm_brzycki
from app.utils.timezone import today_mx

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

    # Send push notification after logging workout
    try:
        from app.services.push_service import send_push_to_user

        total = db.query(sqlfunc.count(Workout.id)).filter(Workout.user_id == user.id).scalar() or 0

        # Count consecutive days streak
        streak = 0
        check_date = data.date
        while True:
            has = db.query(Workout.id).filter(
                Workout.user_id == user.id, Workout.date == check_date
            ).first()
            if has:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break

        if streak > 1:
            title = f"Racha de {streak} dias! 🔥"
            body = f"Llevas {streak} dias seguidos entrenando. No pares!"
        else:
            title = "Entreno registrado! 💪"
            body = f"Llevas {total} entrenamientos en total. Sigue asi!"

        send_push_to_user(db, user.id, title, body, "/")
    except Exception:
        pass  # Don't fail the workout if push fails

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


@router.get("/personal-bests")
def get_personal_bests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the heaviest set (max weight_kg) per exercise for the user."""
    from sqlalchemy import and_

    # Subquery: max weight per exercise
    max_weight_sub = (
        db.query(
            WorkoutSet.exercise_id,
            sqlfunc.max(WorkoutSet.weight_kg).label("max_weight"),
        )
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .filter(Workout.user_id == user.id, WorkoutSet.completed == True)
        .group_by(WorkoutSet.exercise_id)
        .subquery()
    )

    # Get the actual set row for each exercise at max weight (pick highest reps if tie)
    results = (
        db.query(
            WorkoutSet.exercise_id,
            WorkoutSet.weight_kg,
            WorkoutSet.reps,
        )
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .join(
            max_weight_sub,
            and_(
                WorkoutSet.exercise_id == max_weight_sub.c.exercise_id,
                WorkoutSet.weight_kg == max_weight_sub.c.max_weight,
            ),
        )
        .filter(Workout.user_id == user.id, WorkoutSet.completed == True)
        .order_by(WorkoutSet.exercise_id, WorkoutSet.reps.desc())
        .all()
    )

    # Deduplicate: keep first (highest reps) per exercise
    bests = {}
    for exercise_id, weight_kg, reps in results:
        if exercise_id not in bests:
            bests[exercise_id] = {"exercise_id": exercise_id, "weight_kg": weight_kg, "reps": reps}

    return list(bests.values())


@router.get("/today-exercises")
def get_today_exercises(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return list of exercise_ids that the user has logged sets for today."""
    today = today_mx()
    workout = db.query(Workout).filter(
        Workout.user_id == user.id, Workout.date == today
    ).first()

    if not workout:
        return []

    exercise_ids = (
        db.query(WorkoutSet.exercise_id)
        .filter(WorkoutSet.workout_id == workout.id, WorkoutSet.completed == True)
        .distinct()
        .all()
    )
    return [eid for (eid,) in exercise_ids]


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


@router.post("/quick-set")
def log_quick_set(
    exercise_id: int = Query(...),
    weight_kg: float = Query(...),
    reps: int = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a single top set from the routine view. Creates/reuses today's workout."""
    today = today_mx()

    # Find or create today's workout
    workout = db.query(Workout).filter(
        Workout.user_id == user.id, Workout.date == today
    ).first()

    if not workout:
        workout = Workout(user_id=user.id, date=today)
        db.add(workout)
        db.flush()

    # Count existing sets for set_number
    existing = db.query(sqlfunc.count(WorkoutSet.id)).filter(
        WorkoutSet.workout_id == workout.id
    ).scalar() or 0

    ws = WorkoutSet(
        workout_id=workout.id,
        exercise_id=exercise_id,
        set_number=existing + 1,
        reps=reps,
        weight_kg=weight_kg,
        completed=True,
    )
    db.add(ws)

    # Auto-record 1RM
    if 1 <= reps <= 10 and weight_kg > 0:
        epley = calculate_1rm_epley(weight_kg, reps)
        brzycki = calculate_1rm_brzycki(weight_kg, reps)
        avg = (epley + brzycki) / 2
        orm = OneRepMax(
            user_id=user.id,
            exercise_id=exercise_id,
            estimated_1rm=round(avg, 1),
            formula_used="average",
            date=today,
            source_weight=weight_kg,
            source_reps=reps,
        )
        db.add(orm)

    db.commit()
    return {"exercise_id": exercise_id, "weight_kg": weight_kg, "reps": reps, "saved": True}


def _load_workout(db: Session, workout_id: int) -> Workout | None:
    return (
        db.query(Workout)
        .filter(Workout.id == workout_id)
        .options(joinedload(Workout.sets).joinedload(WorkoutSet.exercise))
        .first()
    )
