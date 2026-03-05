"""Seed exercise library and partner brands."""

from sqlalchemy.orm import Session

from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.models.partner_brand import PartnerBrand

EXERCISES = [
    # ── Chest ──
    ("Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Incline Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Incline Dumbbell Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Chest Fly", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Crossover", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Pec Deck", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Dips (Chest)", MuscleGroup.CHEST, "triceps,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    # ── Back ──
    ("Deadlift", MuscleGroup.BACK, "hamstrings,glutes,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Barbell Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Pull-Up", MuscleGroup.BACK, "biceps,forearms", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Lat Pulldown", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Cable"),
    ("Seated Cable Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Cable"),
    ("Dumbbell Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("T-Bar Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Face Pull", MuscleGroup.BACK, "shoulders", ExerciseCategory.ISOLATION, "Cable"),
    ("Straight Arm Pulldown", MuscleGroup.BACK, None, ExerciseCategory.ISOLATION, "Cable"),
    # ── Shoulders ──
    ("Overhead Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Shoulder Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Arnold Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Lateral Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Front Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Reverse Fly", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Lateral Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Cable"),
    # ── Biceps ──
    ("Barbell Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Hammer Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Preacher Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Incline Dumbbell Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Concentration Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    # ── Triceps ──
    ("Close Grip Bench Press", MuscleGroup.TRICEPS, "chest", ExerciseCategory.COMPOUND, "Barbell"),
    ("Tricep Pushdown", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Overhead Tricep Extension", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Skull Crusher", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Dips (Triceps)", MuscleGroup.TRICEPS, "chest,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Cable Kickback", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    # ── Quadriceps ──
    ("Barbell Squat", MuscleGroup.QUADRICEPS, "glutes,hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Front Squat", MuscleGroup.QUADRICEPS, "glutes,abs", ExerciseCategory.COMPOUND, "Barbell"),
    ("Leg Press", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Hack Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Bulgarian Split Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Leg Extension", MuscleGroup.QUADRICEPS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Walking Lunge", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    # ── Hamstrings ──
    ("Romanian Deadlift", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Leg Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Leg Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Stiff Leg Deadlift", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Good Morning", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    # ── Glutes ──
    ("Hip Thrust", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Glute Bridge", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.ISOLATION, "Barbell"),
    ("Cable Kickback (Glute)", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Sumo Deadlift", MuscleGroup.GLUTES, "hamstrings,back", ExerciseCategory.COMPOUND, "Barbell"),
    # ── Calves ──
    ("Standing Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Donkey Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    # ── Abs ──
    ("Cable Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hanging Leg Raise", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Ab Wheel Rollout", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Ab Wheel"),
    ("Plank", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Russian Twist", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Decline Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bench"),
    # ── Traps ──
    ("Barbell Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    # ── Forearms ──
    ("Wrist Curl", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Reverse Wrist Curl", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Farmer's Walk", MuscleGroup.FOREARMS, "traps", ExerciseCategory.COMPOUND, "Dumbbells"),
    # ── Cardio ──
    ("Treadmill Run", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Treadmill"),
    ("Cycling", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Stationary Bike"),
    ("Rowing Machine", MuscleGroup.CARDIO, "back", ExerciseCategory.CARDIO, "Rowing Machine"),
    ("Jump Rope", MuscleGroup.CARDIO, "calves", ExerciseCategory.CARDIO, "Jump Rope"),
    ("Stair Climber", MuscleGroup.CARDIO, "quadriceps,glutes", ExerciseCategory.CARDIO, "Machine"),
]

PARTNER_BRANDS = [
    {
        "name": "Optimum Nutrition",
        "description": "Suplementos de alta calidad para rendimiento deportivo",
        "discount_text": "15% de descuento en proteínas y creatina",
        "promo_code": "FITNESSJOSS15",
        "external_url": "https://www.optimumnutrition.com",
        "category": "suplementos",
    },
    {
        "name": "MyProtein",
        "description": "Nutrición deportiva y suplementos premium",
        "discount_text": "20% en tu primera compra",
        "promo_code": "JOSS20",
        "external_url": "https://www.myprotein.com.mx",
        "category": "suplementos",
    },
    {
        "name": "John Leopard",
        "description": "Ropa deportiva y casual de alta calidad",
        "discount_text": "Descuento exclusivo con código JOSSFIT",
        "promo_code": "JOSSFIT",
        "external_url": "https://johnleopard.com.mx/JOSSFIT",
        "category": "ropa",
    },
    {
        "name": "Fitmart",
        "description": "Alimentos saludables y snacks fitness",
        "discount_text": "10% en productos seleccionados",
        "promo_code": "FITJOSS10",
        "external_url": "https://www.fitmart.com.mx",
        "category": "alimentos",
    },
    {
        "name": "Rogue Fitness",
        "description": "Equipamiento de entrenamiento de calidad profesional",
        "discount_text": "Envío gratis en compras mayores a $2,000",
        "promo_code": "JOSSROGUE",
        "external_url": "https://www.roguefitness.com",
        "category": "equipo",
    },
]


def seed_exercises(db: Session):
    if db.query(Exercise).count() > 0:
        return

    for name, muscle, secondary, category, equipment in EXERCISES:
        db.add(Exercise(
            name=name,
            muscle_group=muscle,
            secondary_muscles=secondary,
            category=category,
            equipment=equipment,
        ))
    db.commit()


def seed_partner_brands(db: Session):
    if db.query(PartnerBrand).count() > 0:
        return

    for brand in PARTNER_BRANDS:
        db.add(PartnerBrand(**brand, active=True))
    db.commit()


def seed_all(db: Session):
    seed_exercises(db)
    seed_partner_brands(db)
