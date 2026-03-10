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
        return {"action": "maintain", "reason": "Ejercicio no encontrado"}

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
            "reason": "Sin datos previos",
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
            "reason": f"Todas las reps completadas con RPE {avg_rpe:.1f}. Listo para subir.",
        }
    elif all_completed and avg_rpe <= 9:
        return {
            "action": "maintain",
            "current_weight": latest_weight,
            "recommended_weight": latest_weight,
            "reason": f"RPE {avg_rpe:.1f} esta alto. Mantener peso hasta que baje.",
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
                "reason": "Varias series fallidas. Reduce el peso 10% para reconstruir.",
            }
        return {
            "action": "maintain",
            "current_weight": latest_weight,
            "recommended_weight": latest_weight,
            "reason": "Algunas reps incompletas. Mantener peso y enfocarse en completar.",
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
            status, rec = "low", f"Considera agregar {10 - count} series mas"
        elif count > 20:
            status, rec = "high", f"Considera reducir {count - 20} series"
        else:
            status, rec = "optimal", "Volumen dentro del rango recomendado (10-20 series)"
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
            f"Volumen semanal ({current_week} series) esta {((current_week/avg_4week)-1)*100:.0f}% "
            f"por encima de tu promedio de 4 semanas ({avg_4week:.0f} series)"
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
            alerts.append(f"Calidad de sueno baja (promedio {avg_quality:.1f}/10)")
        if avg_hours < 6:
            alerts.append(f"Horas de sueno bajas (promedio {avg_hours:.1f}h)")

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
            alerts.append(f"Nivel de fatiga alto (promedio {avg_fatigue:.1f}/10)")

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
        reason = f"Llevas {weeks_training} semanas seguidas entrenando. Un deload ayudara a tu recuperacion."
    elif weeks_training >= 4 and overtraining["risk"] == "high":
        recommended = True
        reason = "Riesgo alto de sobreentrenamiento detectado tras 4+ semanas de entrenamiento."
    elif overtraining["risk"] == "high":
        recommended = True
        reason = "Riesgo alto de sobreentrenamiento. Considera reducir el volumen 40-60% esta semana."

    return {
        "recommended": recommended,
        "reason": reason,
        "weeks_since_deload": weeks_training,
    }
