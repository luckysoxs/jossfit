"""Smart routine generator based on user goals, level, and preferences."""

from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.ai.medical_rules import (
    calculate_risk_level,
    get_safety_alerts,
    get_combined_multipliers,
    get_safety_notes_for_exercise,
    get_disclaimer,
    get_limitation_info,
    get_warmup,
    get_cooldown,
    get_cardio_recommendation,
    get_nutrition_recommendation,
)

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
    "chest_back_legs_shoulders": {
        "name": "Pecho/Espalda - Pierna - Hombro/Brazo",
        "days": [
            {"name": "Pecho y Espalda", "focus": "chest,back", "day_number": 1},
            {"name": "Pierna", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 2},
            {"name": "Hombro y Brazo", "focus": "shoulders,biceps,triceps", "day_number": 3},
            {"name": "Pecho y Espalda", "focus": "chest,back", "day_number": 4},
            {"name": "Pierna", "focus": "quadriceps,hamstrings,glutes,calves", "day_number": 5},
            {"name": "Hombro y Brazo", "focus": "shoulders,biceps,triceps", "day_number": 6},
        ],
    },
}

# Total MAIN exercises per day by training level (optimal volume)
# Accessory muscles (calves, abs, forearms, traps) are added as extras on top
MAX_EXERCISES_PER_DAY = {
    "beginner": 5,
    "intermediate": 7,
    "advanced": 8,
}

# Muscles treated as accessories — 1 exercise each, outside the main budget
ACCESSORY_MUSCLES = {"calves", "abs", "forearms", "traps"}

# ── Weekly volume targets (total sets per muscle per week) ──
# Based on exercise science: optimal hypertrophy = 10-20 sets/muscle/week
WEEKLY_SETS_TARGET = {
    "beginner": {
        "default": 10,  # 10 sets/week per muscle
        "chest": 10, "back": 12, "shoulders": 10,
        "quadriceps": 10, "hamstrings": 8, "glutes": 10,
        "biceps": 8, "triceps": 8,
    },
    "intermediate": {
        "default": 14,
        "chest": 14, "back": 16, "shoulders": 14,
        "quadriceps": 14, "hamstrings": 12, "glutes": 14,
        "biceps": 10, "triceps": 10,
    },
    "advanced": {
        "default": 18,
        "chest": 18, "back": 20, "shoulders": 16,
        "quadriceps": 18, "hamstrings": 14, "glutes": 18,
        "biceps": 14, "triceps": 14,
    },
}

# Exercise similarity groups — at most ONE exercise from each group per day
# Keys are group names, values are sets of exercise names (English)
SIMILAR_GROUPS = {
    "flat_chest_press": {"Bench Press", "Dumbbell Bench Press", "Machine Chest Press", "Floor Press", "Squeeze Press"},
    "incline_chest_press": {"Incline Bench Press", "Incline Dumbbell Press"},
    "decline_chest_press": {"Decline Bench Press", "Decline Dumbbell Press"},
    "chest_fly": {"Chest Fly", "Cable Crossover", "Pec Deck", "Machine Fly", "Low Cable Fly"},
    "shoulder_press": {"Overhead Press", "Dumbbell Shoulder Press", "Arnold Press", "Machine Shoulder Press", "Smith Machine Overhead Press", "Push Press"},
    "lateral_raise": {"Lateral Raise", "Cable Lateral Raise", "Machine Lateral Raise", "Lean-Away Lateral Raise", "Lu Raise"},
    "front_raise": {"Front Raise", "Cable Front Raise", "Plate Front Raise"},
    "rear_delt": {"Reverse Fly", "Rear Delt Cable Fly", "Rear Delt Machine", "Cable Rear Delt Row", "Band Pull Apart"},
    "barbell_row": {"Barbell Row", "Pendlay Row", "T-Bar Row", "Smith Machine Row", "Landmine Row"},
    "lat_pulldown": {"Lat Pulldown", "Close Grip Lat Pulldown", "Wide Grip Lat Pulldown"},
    "pull_up": {"Pull-Up", "Chin-Up", "Neutral Grip Pull-Up"},
    "barbell_squat": {"Barbell Squat", "Front Squat", "Smith Machine Squat"},
    "machine_squat": {"Leg Press", "Hack Squat", "Pendulum Squat", "Belt Squat", "V Squat"},
    "lunge": {"Bulgarian Split Squat", "Walking Lunge", "Reverse Lunge", "Barbell Lunge"},
    "hip_hinge": {"Romanian Deadlift", "Stiff Leg Deadlift", "Dumbbell Romanian Deadlift", "Single Leg Romanian Deadlift"},
    "leg_curl": {"Leg Curl", "Seated Leg Curl", "Single Leg Curl", "Slider Leg Curl", "Swiss Ball Leg Curl"},
    "hip_thrust": {"Hip Thrust", "Single Leg Hip Thrust", "Smith Machine Hip Thrust", "Glute Bridge"},
    "tricep_pushdown": {"Tricep Pushdown", "Rope Pushdown", "Single Arm Pushdown"},
    "overhead_tricep": {"Overhead Tricep Extension", "Overhead Cable Extension", "French Press", "Skull Crusher"},
    "barbell_curl": {"Barbell Curl", "EZ Bar Curl", "Drag Curl", "21s Curl"},
    "dumbbell_curl": {"Dumbbell Curl", "Incline Dumbbell Curl", "Concentration Curl", "Cross Body Curl"},
    "shrug": {"Barbell Shrug", "Dumbbell Shrug", "Cable Shrug", "Smith Machine Shrug", "Overhead Shrug", "Behind the Back Shrug"},
    "calf_raise": {"Standing Calf Raise", "Seated Calf Raise", "Donkey Calf Raise", "Leg Press Calf Raise", "Smith Machine Calf Raise"},
}

# Build reverse lookup: exercise_name -> group_name
_EXERCISE_TO_GROUP = {}
for group_name, exercises in SIMILAR_GROUPS.items():
    for ex_name in exercises:
        _EXERCISE_TO_GROUP[ex_name] = group_name


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


def _allocate_exercises(
    focus_muscles: list[str],
    max_total: int,
    muscle_targets: dict[str, int] | None = None,
) -> dict[str, int]:
    """Distribute exercise budget across muscles.

    Uses per-muscle targets (from weekly volume) when available.
    Otherwise falls back to even distribution.
    The per-muscle cap is dynamic: fewer muscles on a day = more exercises each.
    """
    if not focus_muscles:
        return {}

    # Dynamic cap: depends on how many muscles share this day
    n_muscles = len(focus_muscles)
    if n_muscles == 1:
        per_muscle_cap = max_total  # single muscle day: use full budget
    elif n_muscles == 2:
        per_muscle_cap = min(5, max_total)
    elif n_muscles <= 4:
        per_muscle_cap = min(4, max_total)
    else:
        per_muscle_cap = min(3, max_total)

    # If we have per-muscle targets, use them to set priorities
    if muscle_targets:
        # Sort muscles by target volume descending (bigger muscles get more)
        focus_muscles = sorted(
            focus_muscles,
            key=lambda m: muscle_targets.get(m, 2),
            reverse=True,
        )

    allocation = {}
    budget = max_total

    # Phase 1: 1 exercise per muscle
    for m in focus_muscles:
        allocation[m] = 1
        budget -= 1
        if budget <= 0:
            break

    # Phase 2: distribute remaining proportionally, cap per muscle
    while budget > 0:
        distributed = False
        for m in focus_muscles:
            if budget <= 0:
                break
            target = muscle_targets.get(m, 3) if muscle_targets else per_muscle_cap
            cap = min(per_muscle_cap, max(target, 2))
            if allocation.get(m, 0) < cap:
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
    user_data: dict | None = None,
    custom_days: list[dict] | None = None,
) -> dict:
    """Generate a complete training routine with optimal volume.

    If user_data contains has_condition=True, applies medical
    adjustments from the rules engine.
    """
    is_adaptive = bool(user_data and user_data.get("has_condition"))
    pathologies = (user_data or {}).get("pathologies") or []
    medications = (user_data or {}).get("medications") or []
    limitations = (user_data or {}).get("mobility_limitations") or []
    age = (user_data or {}).get("age", 30)
    weight_kg = (user_data or {}).get("weight_kg", 70)

    # Medical multipliers (defaults to neutral if no conditions)
    mults = get_combined_multipliers(pathologies, medications) if is_adaptive else {
        "max_rpe": 10, "volume_multiplier": 1.0, "rest_multiplier": 1.0, "warmup_duration": 10,
    }
    lim_info = get_limitation_info(limitations) if is_adaptive else {"avoid_patterns": [], "alternatives": [], "prehab": []}

    max_ex = MAX_EXERCISES_PER_DAY.get(training_level, 7)
    # Apply volume multiplier to max exercises
    if is_adaptive:
        max_ex = max(3, int(max_ex * mults["volume_multiplier"]))
    sets_cfg = SETS_CONFIG.get(training_level, SETS_CONFIG["intermediate"])
    reps = REP_RANGES.get(objective, REP_RANGES["hypertrophy"])

    # Custom split: user provides their own day definitions
    if split_preference == "custom" and custom_days:
        split_key = "custom"
        template_name = "Personalizado"
        days_template = [
            {
                "name": d.get("name", f"Día {i+1}"),
                "focus": ",".join(d.get("muscles", [])),
                "day_number": i + 1,
            }
            for i, d in enumerate(custom_days)
        ]
    else:
        split_key = select_split(days_per_week, split_preference)
        template = SPLIT_TEMPLATES[split_key]
        template_name = template["name"]
        days_template = template["days"][:days_per_week]

    # ── Calculate weekly muscle frequency to distribute volume correctly ──
    volume_targets = WEEKLY_SETS_TARGET.get(training_level, WEEKLY_SETS_TARGET["intermediate"])
    muscle_frequency: dict[str, int] = {}  # how many days each muscle appears
    for dt in days_template:
        for m in dt["focus"].split(","):
            m = m.strip()
            if m and m not in ACCESSORY_MUSCLES:
                muscle_frequency[m] = muscle_frequency.get(m, 0) + 1

    # Per-day exercise target for each muscle = ceil(weekly_sets_target / frequency / avg_sets_per_exercise)
    # avg_sets_per_exercise ≈ 3 (compound=3-4, isolation=2-3)
    avg_sets = (sets_cfg["compound"] + sets_cfg["isolation"]) / 2

    routine_days = []
    for day_tmpl in days_template:
        focus_muscles = [m.strip() for m in day_tmpl["focus"].split(",")]

        # Separate main muscles from accessories
        main_muscles = [m for m in focus_muscles if m not in ACCESSORY_MUSCLES]
        accessory_muscles = [m for m in focus_muscles if m in ACCESSORY_MUSCLES]

        # Calculate per-muscle exercise targets for THIS day based on weekly volume
        day_muscle_targets = {}
        for m in main_muscles:
            weekly_target = volume_targets.get(m, volume_targets.get("default", 14))
            freq = muscle_frequency.get(m, 1)
            # How many exercises needed this day to hit weekly target
            sets_this_day = weekly_target / freq
            exercises_needed = max(2, round(sets_this_day / avg_sets))
            day_muscle_targets[m] = exercises_needed

        # Budget allocation using volume-aware targets
        allocation = _allocate_exercises(main_muscles, max_ex, day_muscle_targets) if main_muscles else {}

        exercises_for_day = []
        used_exercise_ids = set()  # Prevent duplicates within the same day
        used_sim_groups = set()    # Prevent similar exercises (e.g. 3 shoulder presses)
        order = 1

        # ── Main muscles (within budget) ──
        for muscle in main_muscles:
            try:
                mg = MuscleGroup(muscle)
            except ValueError:
                continue

            count = allocation.get(muscle, 1)

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

            for ex in compounds:
                if added >= count:
                    break
                if ex.id in used_exercise_ids:
                    continue
                # Skip if same similarity group already used this day
                sim_group = _EXERCISE_TO_GROUP.get(ex.name)
                if sim_group and sim_group in used_sim_groups:
                    continue
                base_rest = 120 if objective == "strength" else 90
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": sets_cfg["compound"] + (1 if is_priority else 0),
                    "reps_min": reps["compound"][0],
                    "reps_max": reps["compound"][1],
                    "rest_seconds": int(base_rest * mults["rest_multiplier"]),
                    "name": ex.name,
                    "muscle_group": muscle,
                    "category": "compound",
                })
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
                # Skip if same similarity group already used this day
                sim_group = _EXERCISE_TO_GROUP.get(ex.name)
                if sim_group and sim_group in used_sim_groups:
                    continue
                exercises_for_day.append({
                    "exercise_id": ex.id,
                    "order": order,
                    "sets": sets_cfg["isolation"] + (1 if is_priority else 0),
                    "reps_min": reps["isolation"][0],
                    "reps_max": reps["isolation"][1],
                    "rest_seconds": int(60 * mults["rest_multiplier"]),
                    "name": ex.name,
                    "muscle_group": muscle,
                    "category": "isolation",
                })
                used_exercise_ids.add(ex.id)
                if sim_group:
                    used_sim_groups.add(sim_group)
                order += 1
                added += 1

        # ── Accessory muscles (extras, 1 exercise each, outside budget) ──
        for muscle in accessory_muscles:
            try:
                mg = MuscleGroup(muscle)
            except ValueError:
                continue

            ex = (
                db.query(Exercise)
                .filter(
                    Exercise.muscle_group == mg,
                    ~Exercise.id.in_(used_exercise_ids),
                )
                .order_by(sqlfunc.random())
                .first()
            )
            if not ex:
                # Fallback: allow reuse if no unique exercise available
                ex = (
                    db.query(Exercise)
                    .filter(Exercise.muscle_group == mg)
                    .order_by(sqlfunc.random())
                    .first()
                )
            if not ex:
                continue

            is_priority = muscle in priority_muscles
            exercises_for_day.append({
                "exercise_id": ex.id,
                "order": order,
                "sets": sets_cfg["isolation"] + (1 if is_priority else 0),
                "reps_min": reps["isolation"][0],
                "reps_max": reps["isolation"][1],
                "rest_seconds": int(60 * mults["rest_multiplier"]),
                "name": ex.name,
                "muscle_group": muscle,
                "category": "isolation",
            })
            used_exercise_ids.add(ex.id)
            order += 1

        routine_days.append({
            "day_number": day_tmpl["day_number"],
            "name": day_tmpl["name"],
            "focus": day_tmpl["focus"],
            "exercises": exercises_for_day,
        })

    # ── Build enriched ai_data for adaptive routines ──
    ai_data = None
    generation_type = "normal"

    if is_adaptive:
        generation_type = "adaptativo"
        risk_level = calculate_risk_level(pathologies, medications, age)
        safety_alerts = get_safety_alerts(pathologies, medications)
        disclaimer = get_disclaimer(risk_level)

        ai_days = []
        for day in routine_days:
            ai_exercises = []
            for ex in day["exercises"]:
                safety_note = get_safety_notes_for_exercise(
                    ex.get("muscle_group", ""), pathologies,
                )
                ai_exercises.append({
                    "nombre": ex.get("name", "Ejercicio"),
                    "grupo_muscular": ex.get("muscle_group", ""),
                    "series": ex["sets"],
                    "repeticiones": f"{ex['reps_min']}-{ex['reps_max']}",
                    "descanso_seg": ex["rest_seconds"],
                    "rpe": f"{mults['max_rpe']}/10",
                    "tempo": "2-1-2",
                    "notas_seguridad": safety_note,
                    "alternativa_facil": None,
                })

            ai_days.append({
                "dia": day["day_number"],
                "nombre": day["name"],
                "enfoque": day["focus"],
                "calentamiento": get_warmup(mults["warmup_duration"], pathologies),
                "ejercicios": ai_exercises,
                "cardio": get_cardio_recommendation(pathologies, objective),
                "vuelta_calma": get_cooldown(pathologies),
            })

        ai_data = {
            "perfil": {
                "modo": "adaptativo",
                "riesgo_global": risk_level,
                "requiere_supervision": risk_level in ("alto", "critico"),
            },
            "disclaimer": disclaimer,
            "alertas_seguridad": safety_alerts,
            "rutina": {
                "fase_actual": "adaptacion",
                "dias": ai_days,
            },
            "nutricion_basica": get_nutrition_recommendation(
                objective, weight_kg, pathologies,
            ),
            "progresion": {
                "criterio": "Completar 2 semanas sin molestias, cumplir RPE indicado",
                "semanas_estimadas": 2,
            },
        }

    return {
        "name": f"{template_name} - {objective.replace('_', ' ').title()}",
        "split_type": split_key,
        "objective": objective,
        "days_per_week": days_per_week,
        "days": routine_days,
        "generation_type": generation_type,
        "ai_data": ai_data,
    }
