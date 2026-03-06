"""Smart routine generator based on user goals, level, and preferences."""

from sqlalchemy.orm import Session

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

# Volume per muscle group per session based on level
VOLUME_MAP = {
    "beginner": {"compound": 3, "isolation": 2, "sets": 3},
    "intermediate": {"compound": 3, "isolation": 3, "sets": 4},
    "advanced": {"compound": 4, "isolation": 3, "sets": 4},
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


def generate_routine(
    db: Session,
    objective: str,
    days_per_week: int,
    training_level: str,
    priority_muscles: list[str],
    split_preference: str | None = None,
) -> dict:
    """Generate a complete training routine."""
    split_key = select_split(days_per_week, split_preference)
    template = SPLIT_TEMPLATES[split_key]
    vol = VOLUME_MAP.get(training_level, VOLUME_MAP["intermediate"])
    reps = REP_RANGES.get(objective, REP_RANGES["hypertrophy"])

    days_template = template["days"][:days_per_week]
    is_full_body = split_key == "full_body"

    routine_days = []
    for day_tmpl in days_template:
        focus_muscles = [m.strip() for m in day_tmpl["focus"].split(",")]

        exercises_for_day = []
        order = 1

        # Limits: full body = 1 compound + 1 isolation per muscle; others = 2+2
        max_compounds = 1 if is_full_body else 2
        max_isolations = 1 if is_full_body else 2

        # Add compound exercises first
        for muscle in focus_muscles:
            try:
                mg = MuscleGroup(muscle)
            except ValueError:
                continue

            compounds = (
                db.query(Exercise)
                .filter(
                    Exercise.muscle_group == mg,
                    Exercise.category == ExerciseCategory.COMPOUND,
                )
                .limit(vol["compound"])
                .all()
            )

            for ex in compounds[:max_compounds]:
                is_priority = muscle in priority_muscles
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": vol["sets"] + (1 if is_priority else 0),
                    "reps_min": reps["compound"][0],
                    "reps_max": reps["compound"][1],
                    "rest_seconds": 120 if objective == "strength" else 90,
                })
                order += 1

        # Add isolation exercises
        for muscle in focus_muscles:
            try:
                mg = MuscleGroup(muscle)
            except ValueError:
                continue

            isolations = (
                db.query(Exercise)
                .filter(
                    Exercise.muscle_group == mg,
                    Exercise.category == ExerciseCategory.ISOLATION,
                )
                .limit(vol["isolation"])
                .all()
            )

            for ex in isolations[:max_isolations]:
                is_priority = muscle in priority_muscles
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": vol["sets"] - 1 + (1 if is_priority else 0),
                    "reps_min": reps["isolation"][0],
                    "reps_max": reps["isolation"][1],
                    "rest_seconds": 60,
                })
                order += 1

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
