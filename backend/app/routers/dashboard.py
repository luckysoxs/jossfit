from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.database import get_db
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.models.body_metric import BodyMetric
from app.models.sleep import SleepLog
from app.models.one_rep_max import OneRepMax
from app.models.exercise import Exercise
from app.schemas.dashboard import DashboardSummary, StrengthProgress
from app.services.algorithms import calculate_weekly_volume, detect_overtraining
from app.auth.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    week_ago = today - timedelta(days=7)

    # Total workouts
    total_workouts = db.query(Workout).filter(Workout.user_id == user.id).count()

    # Workouts this week
    workouts_this_week = (
        db.query(Workout)
        .filter(Workout.user_id == user.id, Workout.date >= week_ago)
        .count()
    )

    # Current streak
    streak = 0
    check_date = today
    while True:
        has_workout = (
            db.query(Workout)
            .filter(Workout.user_id == user.id, Workout.date == check_date)
            .first()
        )
        if has_workout:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            # Allow 1 rest day gap
            check_date -= timedelta(days=1)
            has_prev = (
                db.query(Workout)
                .filter(Workout.user_id == user.id, Workout.date == check_date)
                .first()
            )
            if not has_prev or streak == 0:
                break
            streak += 1
            check_date -= timedelta(days=1)

    # Avg workout duration
    avg_duration = (
        db.query(sqlfunc.avg(Workout.duration_minutes))
        .filter(Workout.user_id == user.id, Workout.duration_minutes.isnot(None))
        .scalar()
    ) or 0

    # Strength progress (top 5 exercises by 1RM records)
    top_exercises = (
        db.query(OneRepMax.exercise_id)
        .filter(OneRepMax.user_id == user.id)
        .group_by(OneRepMax.exercise_id)
        .order_by(sqlfunc.count().desc())
        .limit(5)
        .all()
    )

    strength_progress = []
    for (ex_id,) in top_exercises:
        exercise = db.query(Exercise).filter(Exercise.id == ex_id).first()
        records = (
            db.query(OneRepMax)
            .filter(OneRepMax.user_id == user.id, OneRepMax.exercise_id == ex_id)
            .order_by(OneRepMax.date)
            .all()
        )
        if records and exercise:
            strength_progress.append(
                StrengthProgress(
                    exercise_name=exercise.name,
                    dates=[r.date for r in records],
                    values=[r.estimated_1rm for r in records],
                )
            )

    # Weekly volume
    volume_data = calculate_weekly_volume(db, user.id)
    weekly_volume = {v["muscle_group"]: v["weekly_sets"] for v in volume_data}

    # Body weight
    latest_bw = (
        db.query(BodyMetric)
        .filter(BodyMetric.user_id == user.id, BodyMetric.weight_kg.isnot(None))
        .order_by(BodyMetric.date.desc())
        .first()
    )

    bw_trend = (
        db.query(BodyMetric)
        .filter(BodyMetric.user_id == user.id, BodyMetric.weight_kg.isnot(None))
        .order_by(BodyMetric.date.desc())
        .limit(30)
        .all()
    )

    # Sleep
    recent_sleep = (
        db.query(SleepLog)
        .filter(SleepLog.user_id == user.id, SleepLog.date >= week_ago)
        .all()
    )
    avg_sleep_quality = (
        sum(s.quality for s in recent_sleep) / len(recent_sleep) if recent_sleep else None
    )
    avg_sleep_hours = (
        sum(s.hours_slept for s in recent_sleep) / len(recent_sleep) if recent_sleep else None
    )

    # Recovery score (0-100)
    overtraining = detect_overtraining(db, user.id)
    recovery_base = 80
    if overtraining["risk"] == "high":
        recovery_base = 30
    elif overtraining["risk"] == "moderate":
        recovery_base = 55
    if avg_sleep_quality and avg_sleep_quality >= 7:
        recovery_base += 10
    if avg_sleep_hours and avg_sleep_hours >= 7:
        recovery_base += 10
    recovery_score = min(recovery_base, 100)

    return DashboardSummary(
        total_workouts=total_workouts,
        workouts_this_week=workouts_this_week,
        current_streak=streak,
        avg_workout_duration=round(float(avg_duration), 1),
        strength_progress=strength_progress,
        weekly_volume=weekly_volume,
        latest_body_weight=latest_bw.weight_kg if latest_bw else None,
        body_weight_trend=[
            {"date": str(b.date), "weight": b.weight_kg}
            for b in reversed(bw_trend)
        ],
        avg_sleep_quality=round(avg_sleep_quality, 1) if avg_sleep_quality else None,
        avg_sleep_hours=round(avg_sleep_hours, 1) if avg_sleep_hours else None,
        recovery_score=recovery_score,
    )
