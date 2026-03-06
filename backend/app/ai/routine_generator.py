"""Smart routine generator based on user goals, level, and preferences."""

from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory

# ── Split Templates ──────────────────────────────────────────────
SPLIT_TEMPLATES = {
    "ppl": {
        "name": "Push Pull Legs",
        "days": [
            {"name": "Push", "focus": "chest,shoulders,triceps", "day_number": 1},
            {"name": "Pull", "focus": "back,biceps,forearms", "day_number": 2},
            {"name": "Legs", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 3},
            {"name": "Push", "focus": "chest,shoulders,triceps", "day_number": 4},
            {"name": "Pull", "focus": "back,biceps,forearms", "day_number": 5},
            {"name": "Legs", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 6},
        ],
    },
    "upper_lower": {
        "name": "Upper Lower",
        "days": [
            {"name": "Upper A", "focus": "chest,back,shoulders,biceps,triceps", "day_number": 1},
            {"name": "Lower A", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 2},
            {"name": "Upper B", "focus": "chest,back,shoulders,biceps,triceps", "day_number": 3},
            {"name": "Lower B", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 4},
        ],
    },
    "full_body": {
        "name": "Full Body",
        "days": [
            {"name": "Full Body A", "focus": "chest,back,quadriceps,shoulders,abs", "day_number": 1},
            {"name": "Full Body B", "focus": "back,chest,hamstrings,glutes,biceps", "day_number": 2},
            {"name": "Full Body C", "focus": "quadriceps,back,shoulders,hamstrings,triceps", "day_number": 3},
        ],
    },
    "bro_split": {
        "name": "Bodybuilding Split",
        "days": [
            {"name": "Chest", "focus": "chest,triceps", "day_number": 1},
            {"name": "Back", "focus": "back,biceps", "day_number": 2},
            {"name": "Shoulders", "focus": "shoulders,traps", "day_number": 3},
            {"name": "Legs", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 4},
            {"name": "Arms & Abs", "focus": "biceps,triceps,forearms,abs", "day_number": 5},
        ],
    },
}

# Total exercises per day by training level (optimal volume)
MAX_EXERCISES_PER_DAY = {
    "beginner": 5,
    "intermediate": 7,
    "advanced": 8,
}

# Sets config by level
SETS_CONFIG = {
    "beginner": {"compound": 3, "isolation": 2},
    "intermediate": {"compound": 3, "isolation": 3},
    "advanced": {"compound": 4, "isolation": 3},
}

# Rep ranges by objective
REP_RANGES = {
    "strength": {"compound": (3, 6), "isolation": (6, 10)},
    "hypertrophy": {"compound": (6, 12), "isolation": (8, 15)},
    "endurance": {"compound": (12, 20), "isolation": (15, 25)},
    "fat_loss": {"compound": (8, 15), "isolation": (10, 20)},
    "recomposition": {"compound": (6, 12), "isolation": (8, 15)},
    "muscle_gain": {"compound": (6, 12), "isolation": (8, 15)},
}


def select_split(days_per_week: int, preference: str | None = None) -> str:
    if preference and preference in SPLIT_TEMPLATES:
        return preference
    if days_per_week <= 3:
        return "full_body"
    elif days_per_week == 4:
        return "upper_lower"
    elif days_per_week == 5:
        return "bro_split"
    else:
        return "ppl"


def _allocate_exercises(focus_muscles: list[str], max_total: int) -> dict[str, int]:
    """Distribute exercise budget across muscles.

    First gives 1 exercise per muscle, then distributes remaining
    one-by-one in order (primary muscles first), capped at 3 per muscle.
    """
    allocation = {}
    budget = max_total

    # Phase 1: 1 exercise per muscle
    for m in focus_muscles:
        allocation[m] = 1
        budget -= 1
        if budget <= 0:
            break

    # Phase 2: distribute remaining 1 at a time, cap at 3
    while budget > 0:
        distributed = False
        for m in focus_muscles:
            if budget <= 0:
                break
            if allocation.get(m, 0) < 3:
                allocation[m] = allocation.get(m, 0) + 1
                budget -= 1
                distributed = True
        if not distributed:
            break

    return allocation


def generate_routine(
    db: Session,
    objective: str,
    days_per_week: int,
    training_level: str,
    priority_muscles: list[str],
    split_preference: str | None = None,
) -> dict:
    """Generate a complete training routine with optimal volume."""
    split_key = select_split(days_per_week, split_preference)
    template = SPLIT_TEMPLATES[split_key]
    max_ex = MAX_EXERCISES_PER_DAY.get(training_level, 7)
    sets_cfg = SETS_CONFIG.get(training_level, SETS_CONFIG["intermediate"])
    reps = REP_RANGES.get(objective, REP_RANGES["hypertrophy"])

    days_template = template["days"][:days_per_week]

    routine_days = []
    for day_tmpl in days_template:
        focus_muscles = [m.strip() for m in day_tmpl["focus"].split(",")]

        # Allocate exercises per muscle for this day
        allocation = _allocate_exercises(focus_muscles, max_ex)

        exercises_for_day = []
        order = 1

        for muscle in focus_muscles:
            try:
                mg = MuscleGroup(muscle)
            except ValueError:
                continue

            count = allocation.get(muscle, 1)

            # Query available exercises (randomized via order_by for variety)
            compounds = (
                db.query(Exercise)
                .filter(
                    Exercise.muscle_group == mg,
                    Exercise.category == ExerciseCategory.COMPOUND,
                )
                .order_by(sqlfunc.random())
                .all()
            )

            isolations = (
                db.query(Exercise)
                .filter(
                    Exercise.muscle_group == mg,
                    Exercise.category == ExerciseCategory.ISOLATION,
                )
                .order_by(sqlfunc.random())
                .all()
            )

            added = 0
            is_priority = muscle in priority_muscles

            # Add compounds first (at least 1 if available)
            for ex in compounds:
                if added >= count:
                    break
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": sets_cfg["compound"] + (1 if is_priority else 0),
                    "reps_min": reps["compound"][0],
                    "reps_max": reps["compound"][1],
                    "rest_seconds": 120 if objective == "strength" else 90,
                })
                order += 1
                added += 1

            # Fill remaining with isolations
            for ex in isolations:
                if added >= count:
                    break
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": sets_cfg["isolation"] + (1 if is_priority else 0),
                    "reps_min": reps["isolation"][0],
                    "reps_max": reps["isolation"][1],
                    "rest_seconds": 60,
                })
                order += 1
                added += 1

        routine_days.append({
            "day_number": day_tmpl["day_number"],
            "name": day_tmpl["name"],
            "focus": day_tmpl["focus"],
            "exercises": exercises_for_day,
        })

    return {
        "name": f"{template['name']} - {objective.replace('_', ' ').title()}",
        "split_type": split_key,
        "objective": objective,
        "days_per_week": days_per_week,
        "days": routine_days,
    }
