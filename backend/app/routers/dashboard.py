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
from app.models.routine import Routine
from app.models.notification import Notification
from app.models.support_message import SupportMessage
from app.schemas.dashboard import DashboardSummary, StrengthProgress, StrengthScoreResponse, CategoryScore
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

    active_routine = db.query(Routine).filter(Routine.user_id == user.id).first()

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
        active_routine_id=active_routine.id if active_routine else None,
        active_routine_name=active_routine.name if active_routine else None,
    )


PUSH_MUSCLES = {"chest", "shoulders", "triceps"}
PULL_MUSCLES = {"back", "biceps", "traps", "forearms"}
LEG_MUSCLES = {"quadriceps", "hamstrings", "glutes", "calves"}
CORE_MUSCLES = {"abs", "full_body"}

CATEGORY_LABELS = {
    "push": "Empuje",
    "pull": "Tirón",
    "legs": "Piernas",
    "core": "Core",
}


def _classify_muscle(muscle_group: str) -> str:
    mg = muscle_group.lower()
    if mg in PUSH_MUSCLES:
        return "push"
    if mg in PULL_MUSCLES:
        return "pull"
    if mg in LEG_MUSCLES:
        return "legs"
    return "core"


def _calc_strength_scores(db: Session, user_id: int, before_date=None):
    """Get the best 1RM per exercise (optionally only records before a date)."""
    from sqlalchemy import func as sf

    q = (
        db.query(
            OneRepMax.exercise_id,
            sf.max(OneRepMax.estimated_1rm).label("best_1rm"),
        )
        .filter(OneRepMax.user_id == user_id)
    )
    if before_date:
        q = q.filter(OneRepMax.date < before_date)
    q = q.group_by(OneRepMax.exercise_id)

    results = {}  # category -> { total, exercises: [{name, 1rm}] }
    for cat in ("push", "pull", "legs", "core"):
        results[cat] = {"total": 0.0, "exercises": []}

    for ex_id, best_1rm in q.all():
        exercise = db.query(Exercise).filter(Exercise.id == ex_id).first()
        if not exercise:
            continue
        cat = _classify_muscle(exercise.muscle_group.value if hasattr(exercise.muscle_group, 'value') else exercise.muscle_group)
        results[cat]["total"] += best_1rm
        results[cat]["exercises"].append({
            "name": exercise.name_es or exercise.name,
            "1rm": best_1rm,
        })

    return results


@router.get("/strength-score", response_model=StrengthScoreResponse)
def get_strength_score(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    month_ago = today - timedelta(days=30)

    # Current scores
    current = _calc_strength_scores(db, user.id)
    total_score = sum(c["total"] for c in current.values())

    # Previous scores (30 days ago)
    previous = _calc_strength_scores(db, user.id, before_date=month_ago)
    previous_score = sum(c["total"] for c in previous.values())

    # Body weight
    latest_bw = (
        db.query(BodyMetric)
        .filter(BodyMetric.user_id == user.id, BodyMetric.weight_kg.isnot(None))
        .order_by(BodyMetric.date.desc())
        .first()
    )
    body_weight = latest_bw.weight_kg if latest_bw else None
    strength_ratio = round(total_score / body_weight, 2) if body_weight and total_score > 0 else None

    # Change %
    change_pct = None
    if previous_score > 0 and total_score > 0:
        change_pct = round(((total_score - previous_score) / previous_score) * 100, 1)

    categories = []
    for cat in ("push", "pull", "legs", "core"):
        data = current[cat]
        exercises_sorted = sorted(data["exercises"], key=lambda x: x["1rm"], reverse=True)
        top = exercises_sorted[0] if exercises_sorted else None
        categories.append(CategoryScore(
            category=cat,
            label=CATEGORY_LABELS[cat],
            total_1rm=round(data["total"], 1),
            exercise_count=len(data["exercises"]),
            top_exercise=top["name"] if top else None,
            top_1rm=round(top["1rm"], 1) if top else None,
        ))

    return StrengthScoreResponse(
        total_score=round(total_score, 1),
        categories=categories,
        body_weight=body_weight,
        strength_ratio=strength_ratio,
        previous_score=round(previous_score, 1) if previous_score > 0 else None,
        change_pct=change_pct,
    )


@router.get("/unread-counts")
def get_unread_counts(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Single endpoint that returns ALL unread counts — saves 2-3 API calls per poll."""
    # Notifications
    notif_count = (
        db.query(sqlfunc.count(Notification.id))
        .filter(Notification.user_id == user.id, Notification.is_read == False)
        .scalar() or 0
    )

    # Support messages (unread admin replies)
    support_count = (
        db.query(sqlfunc.count(SupportMessage.id))
        .filter(
            SupportMessage.user_id == user.id,
            SupportMessage.is_from_admin == True,
            SupportMessage.is_read == False,
        )
        .scalar() or 0
    )

    # Unread note notifications
    notes_count = (
        db.query(sqlfunc.count(Notification.id))
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
            Notification.url.like("/notes%"),
        )
        .scalar() or 0
    )

    # Walkie-talkie (admin only)
    walkie_count = 0
    if user.is_admin:
        from app.models.admin_chat import AdminChatMember, AdminChatMessage
        memberships = db.query(AdminChatMember).filter(AdminChatMember.user_id == user.id).all()
        for m in memberships:
            q = db.query(sqlfunc.count(AdminChatMessage.id)).filter(
                AdminChatMessage.chat_id == m.chat_id,
                AdminChatMessage.sender_id != user.id,
            )
            if m.last_read_at:
                q = q.filter(AdminChatMessage.created_at > m.last_read_at)
            walkie_count += q.scalar() or 0

    return {
        "notifications": notif_count,
        "support": support_count,
        "walkie": walkie_count,
        "notes": notes_count,
    }
