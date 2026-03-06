"""Seed exercise library, partner brands, and admin user."""

from sqlalchemy.orm import Session

from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.models.partner_brand import PartnerBrand
from app.models.user import User
from app.auth.security import hash_password

EXERCISES = [
    # ── Chest ──
    ("Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Incline Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Decline Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Bench Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Incline Dumbbell Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Decline Dumbbell Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Chest Press", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Dips (Chest)", MuscleGroup.CHEST, "triceps,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Push-Up", MuscleGroup.CHEST, "triceps,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Landmine Press", MuscleGroup.CHEST, "shoulders", ExerciseCategory.COMPOUND, "Barbell"),
    ("Chest Fly", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Incline Dumbbell Fly", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Crossover", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Incline Cable Fly", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Low Cable Fly", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Pec Deck", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Svend Press", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Plate"),

    # ── Back ──
    ("Deadlift", MuscleGroup.BACK, "hamstrings,glutes,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Barbell Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Pendlay Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("T-Bar Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Pull-Up", MuscleGroup.BACK, "biceps,forearms", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Chin-Up", MuscleGroup.BACK, "biceps,forearms", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Lat Pulldown", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Cable"),
    ("Close Grip Lat Pulldown", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Cable"),
    ("Seated Cable Row", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Cable"),
    ("Dumbbell Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Chest Supported Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Inverted Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Rack Pull", MuscleGroup.BACK, "traps,glutes", ExerciseCategory.COMPOUND, "Barbell"),
    ("Meadows Row", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Face Pull", MuscleGroup.BACK, "shoulders", ExerciseCategory.ISOLATION, "Cable"),
    ("Straight Arm Pulldown", MuscleGroup.BACK, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Cable Pullover", MuscleGroup.BACK, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hyperextension", MuscleGroup.BACK, "glutes,hamstrings", ExerciseCategory.ISOLATION, "Bodyweight"),

    # ── Shoulders ──
    ("Overhead Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Shoulder Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Arnold Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Shoulder Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Smith Machine Overhead Press", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Smith Machine"),
    ("Push Press", MuscleGroup.SHOULDERS, "triceps,legs", ExerciseCategory.COMPOUND, "Barbell"),
    ("Lateral Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Lateral Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Machine Lateral Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Front Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Reverse Fly", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Rear Delt Cable Fly", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Cable"),
    ("Upright Row", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Y-Raise", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Rear Delt Machine", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Machine"),

    # ── Biceps ──
    ("Barbell Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Barbell"),
    ("EZ Bar Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Dumbbell Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Hammer Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Preacher Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Incline Dumbbell Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Concentration Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Spider Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Drag Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Reverse Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Barbell"),
    ("Cable Hammer Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Cable"),
    ("Machine Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Zottman Curl", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Bayesian Curl", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Cable"),

    # ── Triceps ──
    ("Close Grip Bench Press", MuscleGroup.TRICEPS, "chest", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dips (Triceps)", MuscleGroup.TRICEPS, "chest,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Diamond Push-Up", MuscleGroup.TRICEPS, "chest", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Tricep Pushdown", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Rope Pushdown", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Overhead Tricep Extension", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Overhead Cable Extension", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Skull Crusher", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Cable Kickback", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Single Arm Pushdown", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("French Press", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Bench Dip", MuscleGroup.TRICEPS, "chest", ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Tricep Machine", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Machine"),

    # ── Quadriceps ──
    ("Barbell Squat", MuscleGroup.QUADRICEPS, "glutes,hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Front Squat", MuscleGroup.QUADRICEPS, "glutes,abs", ExerciseCategory.COMPOUND, "Barbell"),
    ("Leg Press", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Hack Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Bulgarian Split Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Walking Lunge", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Goblet Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Smith Machine Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Smith Machine"),
    ("Pendulum Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Belt Squat", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Step Up", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Sissy Squat", MuscleGroup.QUADRICEPS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Leg Extension", MuscleGroup.QUADRICEPS, None, ExerciseCategory.ISOLATION, "Machine"),

    # ── Hamstrings ──
    ("Romanian Deadlift", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Stiff Leg Deadlift", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Romanian Deadlift", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Good Morning", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Glute Ham Raise", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Leg Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Leg Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Nordic Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Single Leg Curl", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Cable Pull Through", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.ISOLATION, "Cable"),

    # ── Glutes ──
    ("Hip Thrust", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Sumo Deadlift", MuscleGroup.GLUTES, "hamstrings,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Single Leg Hip Thrust", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Glute Bridge", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.ISOLATION, "Barbell"),
    ("Cable Kickback (Glute)", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hip Abduction Machine", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Frog Pump", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Bodyweight"),

    # ── Calves ──
    ("Standing Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Donkey Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Leg Press Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Single Leg Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Smith Machine Calf Raise", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Smith Machine"),

    # ── Abs ──
    ("Cable Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hanging Leg Raise", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Ab Wheel Rollout", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Ab Wheel"),
    ("Plank", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Russian Twist", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Decline Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bench"),
    ("Bicycle Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Reverse Crunch", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("V-Up", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Dead Bug", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Pallof Press", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Woodchop", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Mountain Climbers", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Leg Raise", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),

    # ── Traps ──
    ("Barbell Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Smith Machine Shrug", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Smith Machine"),

    # ── Forearms ──
    ("Wrist Curl", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Reverse Wrist Curl", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Farmer's Walk", MuscleGroup.FOREARMS, "traps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Plate Pinch", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Plate"),
    ("Behind the Back Wrist Curl", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),

    # ── Cardio ──
    ("Treadmill Run", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Treadmill"),
    ("Cycling", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Stationary Bike"),
    ("Rowing Machine", MuscleGroup.CARDIO, "back", ExerciseCategory.CARDIO, "Rowing Machine"),
    ("Jump Rope", MuscleGroup.CARDIO, "calves", ExerciseCategory.CARDIO, "Jump Rope"),
    ("Stair Climber", MuscleGroup.CARDIO, "quadriceps,glutes", ExerciseCategory.CARDIO, "Machine"),
    ("Battle Ropes", MuscleGroup.CARDIO, "shoulders,back", ExerciseCategory.CARDIO, "Battle Ropes"),
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
    """Add any missing exercises (additive — won't duplicate existing ones)."""
    existing_names = {name for (name,) in db.query(Exercise.name).all()}

    added = 0
    for name, muscle, secondary, category, equipment in EXERCISES:
        if name not in existing_names:
            db.add(Exercise(
                name=name,
                muscle_group=muscle,
                secondary_muscles=secondary,
                category=category,
                equipment=equipment,
            ))
            added += 1

    if added > 0:
        db.commit()


def seed_partner_brands(db: Session):
    if db.query(PartnerBrand).count() > 0:
        return

    for brand in PARTNER_BRANDS:
        db.add(PartnerBrand(**brand, active=True))
    db.commit()


def seed_admin(db: Session):
    admin = db.query(User).filter(User.email == "admin@jossfit.pro").first()
    if not admin:
        admin = User(
            email="admin@jossfit.pro",
            password_hash=hash_password("AdminJossFit2024!"),
            name="Jos Admin",
            age=25,
            sex="male",
            height_cm=175,
            weight_kg=80,
            training_level="advanced",
            fitness_goal="strength",
            is_admin=True,
            phone="5512345678",
            country_code="+52",
        )
        db.add(admin)
        db.commit()
    elif not admin.is_admin:
        admin.is_admin = True
        db.commit()


def seed_all(db: Session):
    seed_exercises(db)
    seed_partner_brands(db)
    seed_admin(db)
