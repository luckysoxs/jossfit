"""Core fitness algorithms: 1RM estimation, progression, volume, overtraining, deload."""

from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.workout import Workout, WorkoutSet
from app.models.exercise import Exercise, ExerciseCategory
from app.models.sleep import SleepLog
from app.models.one_rep_max import OneRepMax


# ─── 1RM Calculation ──────────────────────────────────────────────
def calculate_1rm_epley(weight: float, reps: int) -> float:
    if reps == 1:
        return weight
    return round(weight * (1 + reps / 30), 1)


def calculate_1rm_brzycki(weight: float, reps: int) -> float:
    if reps == 1:
        return weight
    if reps >= 37:
        return weight
    return round(weight * 36 / (37 - reps), 1)


# ─── Auto Progression ─────────────────────────────────────────────
def get_progression_recommendation(
    db: Session, user_id: int, exercise_id: int
) -> dict:
    """Analyze recent workout sets for an exercise and recommend next weight."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        return {"action": "maintain", "reason": "Exercise not found"}

    # Get last 3 workouts with this exercise
    recent_sets = (
        db.query(WorkoutSet)
        .join(Workout)
        .filter(
            Workout.user_id == user_id,
            WorkoutSet.exercise_id == exercise_id,
        )
        .order_by(Workout.date.desc(), WorkoutSet.set_number)
        .limit(15)
        .all()
    )

    if not recent_sets:
        return {
            "action": "maintain",
            "current_weight": 0,
            "recommended_weight": 0,
            "reason": "No previous data",
        }

    latest_weight = recent_sets[0].weight_kg
    latest_reps = [s for s in recent_sets if s.weight_kg == latest_weight]

    all_completed = all(s.completed for s in latest_reps)
    avg_rpe = sum(s.rpe or 7 for s in latest_reps) / len(latest_reps)

    is_compound = exercise.category == ExerciseCategory.COMPOUND
    increment_pct = 0.025 if is_compound else 0.05

    if all_completed and avg_rpe < 8:
        new_weight = round(latest_weight * (1 + increment_pct), 1)
        # Round to nearest 2.5
        new_weight = round(new_weight / 2.5) * 2.5
        return {
            "action": "increase",
            "current_weight": latest_weight,
            "recommended_weight": new_weight,
            "reason": f"All reps completed with RPE {avg_rpe:.1f}. Ready to progress.",
        }
    elif all_completed and avg_rpe <= 9:
        return {
            "action": "maintain",
            "current_weight": latest_weight,
            "recommended_weight": latest_weight,
            "reason": f"RPE {avg_rpe:.1f} is high. Maintain weight until RPE drops.",
        }
    else:
        # Check if failed multiple sessions
        failed_count = sum(1 for s in recent_sets[:6] if not s.completed)
        if failed_count >= 3:
            new_weight = round(latest_weight * 0.9, 1)
            new_weight = round(new_weight / 2.5) * 2.5
            return {
                "action": "decrease",
                "current_weight": latest_weight,
                "recommended_weight": new_weight,
                "reason": "Multiple failed sets. Reduce weight 10% to rebuild.",
            }
        return {
            "action": "maintain",
            "current_weight": latest_weight,
            "recommended_weight": latest_weight,
            "reason": "Some reps missed. Maintain weight and focus on completion.",
        }


# ─── Volume Analysis ──────────────────────────────────────────────
def calculate_weekly_volume(db: Session, user_id: int) -> list[dict]:
    """Calculate sets per muscle group in the last 7 days."""
    week_ago = date.today() - timedelta(days=7)
    sets = (
        db.query(WorkoutSet)
        .join(Workout)
        .join(Exercise, WorkoutSet.exercise_id == Exercise.id)
        .filter(Workout.user_id == user_id, Workout.date >= week_ago)
        .all()
    )

    volume = defaultdict(int)
    for s in sets:
        if s.completed and s.exercise:
            volume[s.exercise.muscle_group.value] += 1
            # Count secondary muscles as half a set
            if s.exercise.secondary_muscles:
                for m in s.exercise.secondary_muscles.split(","):
                    volume[m.strip()] += 0.5

    results = []
    for muscle, count in sorted(volume.items()):
        count = int(count)
        if count < 10:
            status, rec = "low", f"Consider adding {10 - count} more sets"
        elif count > 20:
            status, rec = "high", f"Consider reducing by {count - 20} sets"
        else:
            status, rec = "optimal", "Volume is within recommended range (10-20 sets)"
        results.append({
            "muscle_group": muscle,
            "weekly_sets": count,
            "status": status,
            "recommendation": rec,
        })
    return results


# ─── Overtraining Detection ───────────────────────────────────────
def detect_overtraining(db: Session, user_id: int) -> dict:
    """Analyze training data for overtraining signals."""
    today = date.today()
    alerts = []

    # 1. Check weekly volume vs 4-week average
    weeks_data = []
    for w in range(5):
        start = today - timedelta(days=7 * (w + 1))
        end = today - timedelta(days=7 * w)
        count = (
            db.query(WorkoutSet)
            .join(Workout)
            .filter(
                Workout.user_id == user_id,
                Workout.date >= start,
                Workout.date < end,
                WorkoutSet.completed == True,
            )
            .count()
        )
        weeks_data.append(count)

    current_week = weeks_data[0] if weeks_data else 0
    avg_4week = sum(weeks_data[1:5]) / max(len(weeks_data[1:5]), 1) if len(weeks_data) > 1 else 0

    if avg_4week > 0 and current_week > avg_4week * 1.2:
        alerts.append(
            f"Weekly volume ({current_week} sets) is {((current_week/avg_4week)-1)*100:.0f}% "
            f"above your 4-week average ({avg_4week:.0f} sets)"
        )

    # 2. Check sleep quality
    recent_sleep = (
        db.query(SleepLog)
        .filter(SleepLog.user_id == user_id, SleepLog.date >= today - timedelta(days=7))
        .all()
    )
    if recent_sleep:
        avg_quality = sum(s.quality for s in recent_sleep) / len(recent_sleep)
        avg_hours = sum(s.hours_slept for s in recent_sleep) / len(recent_sleep)
        if avg_quality < 5:
            alerts.append(f"Sleep quality is poor (avg {avg_quality:.1f}/10)")
        if avg_hours < 6:
            alerts.append(f"Sleep duration is low (avg {avg_hours:.1f}h)")

    # 3. Check fatigue levels
    recent_workouts = (
        db.query(Workout)
        .filter(Workout.user_id == user_id, Workout.date >= today - timedelta(days=7))
        .all()
    )
    fatigue_levels = [w.fatigue_level for w in recent_workouts if w.fatigue_level]
    if fatigue_levels:
        avg_fatigue = sum(fatigue_levels) / len(fatigue_levels)
        if avg_fatigue > 7:
            alerts.append(f"Fatigue levels are high (avg {avg_fatigue:.1f}/10)")

    # Determine risk level
    if len(alerts) >= 3:
        risk = "high"
    elif len(alerts) >= 1:
        risk = "moderate"
    else:
        risk = "low"

    return {"risk": risk, "alerts": alerts}


# ─── Deload Recommendation ────────────────────────────────────────
def check_deload_needed(db: Session, user_id: int) -> dict:
    """Check if a deload week is recommended."""
    today = date.today()

    # Count consecutive training weeks
    weeks_training = 0
    for w in range(8):
        start = today - timedelta(days=7 * (w + 1))
        end = today - timedelta(days=7 * w)
        count = (
            db.query(Workout)
            .filter(Workout.user_id == user_id, Workout.date >= start, Workout.date < end)
            .count()
        )
        if count > 0:
            weeks_training += 1
        else:
            break

    overtraining = detect_overtraining(db, user_id)

    recommended = False
    reason = None

    if weeks_training >= 6:
        recommended = True
        reason = f"You've trained {weeks_training} consecutive weeks. A deload will aid recovery."
    elif weeks_training >= 4 and overtraining["risk"] == "high":
        recommended = True
        reason = "High overtraining risk detected after 4+ weeks of training."
    elif overtraining["risk"] == "high":
        recommended = True
        reason = "High overtraining risk. Consider reducing volume 40-60% this week."

    return {
        "recommended": recommended,
        "reason": reason,
        "weeks_since_deload": weeks_training,
    }
