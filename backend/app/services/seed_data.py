"""Seed exercise library, partner brands, and admin user."""

from sqlalchemy.orm import Session

from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory
from app.models.partner_brand import PartnerBrand
from app.models.user import User
from app.auth.security import hash_password

# (name_en, name_es, muscle_group, secondary, category, equipment)
EXERCISES = [
    # ── Chest ──
    ("Bench Press", "Press de Banca", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Incline Bench Press", "Press Inclinado con Barra", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Decline Bench Press", "Press Declinado con Barra", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Bench Press", "Press de Banca con Mancuernas", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Incline Dumbbell Press", "Press Inclinado con Mancuernas", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Decline Dumbbell Press", "Press Declinado con Mancuernas", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Chest Press", "Press de Pecho en Máquina", MuscleGroup.CHEST, "shoulders,triceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Dips (Chest)", "Fondos (Pecho)", MuscleGroup.CHEST, "triceps,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Push-Up", "Lagartija", MuscleGroup.CHEST, "triceps,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Landmine Press", "Press Landmine", MuscleGroup.CHEST, "shoulders", ExerciseCategory.COMPOUND, "Barbell"),
    ("Chest Fly", "Aperturas de Pecho", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Incline Dumbbell Fly", "Aperturas Inclinadas", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Crossover", "Cruce de Cables", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Incline Cable Fly", "Aperturas con Cable Inclinado", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Low Cable Fly", "Aperturas con Cable Bajo", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Pec Deck", "Pec Deck", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Svend Press", "Press Svend", MuscleGroup.CHEST, None, ExerciseCategory.ISOLATION, "Plate"),

    # ── Back ──
    ("Deadlift", "Peso Muerto", MuscleGroup.BACK, "hamstrings,glutes,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Barbell Row", "Remo con Barra", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Pendlay Row", "Remo Pendlay", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("T-Bar Row", "Remo en T", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Pull-Up", "Dominada", MuscleGroup.BACK, "biceps,forearms", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Chin-Up", "Dominada Supina", MuscleGroup.BACK, "biceps,forearms", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Lat Pulldown", "Jalón al Pecho", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Cable"),
    ("Close Grip Lat Pulldown", "Jalón Agarre Cerrado", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Cable"),
    ("Seated Cable Row", "Remo Sentado con Cable", MuscleGroup.BACK, "biceps,traps", ExerciseCategory.COMPOUND, "Cable"),
    ("Dumbbell Row", "Remo con Mancuerna", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Chest Supported Row", "Remo con Apoyo en Pecho", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Row", "Remo en Máquina", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Inverted Row", "Remo Invertido", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Rack Pull", "Rack Pull", MuscleGroup.BACK, "traps,glutes", ExerciseCategory.COMPOUND, "Barbell"),
    ("Meadows Row", "Remo Meadows", MuscleGroup.BACK, "biceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Face Pull", "Face Pull", MuscleGroup.BACK, "shoulders", ExerciseCategory.ISOLATION, "Cable"),
    ("Straight Arm Pulldown", "Jalón con Brazos Rectos", MuscleGroup.BACK, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Cable Pullover", "Pullover con Cable", MuscleGroup.BACK, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hyperextension", "Hiperextensión", MuscleGroup.BACK, "glutes,hamstrings", ExerciseCategory.ISOLATION, "Bodyweight"),

    # ── Shoulders ──
    ("Overhead Press", "Press Militar", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Shoulder Press", "Press de Hombro con Mancuernas", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Arnold Press", "Press Arnold", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Machine Shoulder Press", "Press de Hombro en Máquina", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Machine"),
    ("Smith Machine Overhead Press", "Press Militar en Smith", MuscleGroup.SHOULDERS, "triceps", ExerciseCategory.COMPOUND, "Smith Machine"),
    ("Push Press", "Push Press", MuscleGroup.SHOULDERS, "triceps,legs", ExerciseCategory.COMPOUND, "Barbell"),
    ("Lateral Raise", "Elevación Lateral", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Lateral Raise", "Elevación Lateral con Cable", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Machine Lateral Raise", "Elevación Lateral en Máquina", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Front Raise", "Elevación Frontal", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Reverse Fly", "Pájaro Inverso", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Rear Delt Cable Fly", "Pájaro Posterior con Cable", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Cable"),
    ("Upright Row", "Remo al Mentón", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Y-Raise", "Elevación en Y", MuscleGroup.SHOULDERS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Rear Delt Machine", "Máquina de Deltoides Posterior", MuscleGroup.SHOULDERS, "traps", ExerciseCategory.ISOLATION, "Machine"),

    # ── Biceps ──
    ("Barbell Curl", "Curl con Barra", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Barbell"),
    ("EZ Bar Curl", "Curl con Barra Z", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Dumbbell Curl", "Curl con Mancuernas", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Hammer Curl", "Curl Martillo", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Preacher Curl", "Curl Predicador", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Incline Dumbbell Curl", "Curl Inclinado con Mancuernas", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Curl", "Curl con Cable", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Concentration Curl", "Curl Concentrado", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Spider Curl", "Curl Araña", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Drag Curl", "Curl Arrastre", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Reverse Curl", "Curl Inverso", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Barbell"),
    ("Cable Hammer Curl", "Curl Martillo con Cable", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Cable"),
    ("Machine Curl", "Curl en Máquina", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Zottman Curl", "Curl Zottman", MuscleGroup.BICEPS, "forearms", ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Bayesian Curl", "Curl Bayesiano", MuscleGroup.BICEPS, None, ExerciseCategory.ISOLATION, "Cable"),

    # ── Triceps ──
    ("Close Grip Bench Press", "Press Agarre Cerrado", MuscleGroup.TRICEPS, "chest", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dips (Triceps)", "Fondos (Tríceps)", MuscleGroup.TRICEPS, "chest,shoulders", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Diamond Push-Up", "Lagartija Diamante", MuscleGroup.TRICEPS, "chest", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Tricep Pushdown", "Jalón de Tríceps", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Rope Pushdown", "Jalón con Cuerda", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Overhead Tricep Extension", "Extensión de Tríceps sobre Cabeza", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Overhead Cable Extension", "Extensión con Cable sobre Cabeza", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Skull Crusher", "Rompecráneos", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Cable Kickback", "Patada de Tríceps con Cable", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Single Arm Pushdown", "Jalón de Tríceps a una Mano", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("French Press", "Press Francés", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "EZ Bar"),
    ("Bench Dip", "Fondo en Banco", MuscleGroup.TRICEPS, "chest", ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Tricep Machine", "Máquina de Tríceps", MuscleGroup.TRICEPS, None, ExerciseCategory.ISOLATION, "Machine"),

    # ── Quadriceps ──
    ("Barbell Squat", "Sentadilla con Barra", MuscleGroup.QUADRICEPS, "glutes,hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Front Squat", "Sentadilla Frontal", MuscleGroup.QUADRICEPS, "glutes,abs", ExerciseCategory.COMPOUND, "Barbell"),
    ("Leg Press", "Prensa de Piernas", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Hack Squat", "Sentadilla Hack", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Bulgarian Split Squat", "Sentadilla Búlgara", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Walking Lunge", "Zancada Caminando", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Goblet Squat", "Sentadilla Goblet", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Smith Machine Squat", "Sentadilla en Smith", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Smith Machine"),
    ("Pendulum Squat", "Sentadilla Péndulo", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Belt Squat", "Sentadilla con Cinturón", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Machine"),
    ("Step Up", "Step Up", MuscleGroup.QUADRICEPS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Sissy Squat", "Sentadilla Sissy", MuscleGroup.QUADRICEPS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Leg Extension", "Extensión de Piernas", MuscleGroup.QUADRICEPS, None, ExerciseCategory.ISOLATION, "Machine"),

    # ── Hamstrings ──
    ("Romanian Deadlift", "Peso Muerto Rumano", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Stiff Leg Deadlift", "Peso Muerto Piernas Rígidas", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Dumbbell Romanian Deadlift", "Peso Muerto Rumano con Mancuernas", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Good Morning", "Buenos Días", MuscleGroup.HAMSTRINGS, "glutes,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Glute Ham Raise", "Glute Ham Raise", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Leg Curl", "Curl de Piernas", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Leg Curl", "Curl de Piernas Sentado", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Nordic Curl", "Curl Nórdico", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Single Leg Curl", "Curl de Pierna Individual", MuscleGroup.HAMSTRINGS, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Cable Pull Through", "Pull Through con Cable", MuscleGroup.HAMSTRINGS, "glutes", ExerciseCategory.ISOLATION, "Cable"),

    # ── Glutes ──
    ("Hip Thrust", "Empuje de Cadera", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.COMPOUND, "Barbell"),
    ("Sumo Deadlift", "Peso Muerto Sumo", MuscleGroup.GLUTES, "hamstrings,back", ExerciseCategory.COMPOUND, "Barbell"),
    ("Single Leg Hip Thrust", "Empuje de Cadera a una Pierna", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.COMPOUND, "Bodyweight"),
    ("Glute Bridge", "Puente de Glúteos", MuscleGroup.GLUTES, "hamstrings", ExerciseCategory.ISOLATION, "Barbell"),
    ("Cable Kickback (Glute)", "Patada con Cable (Glúteo)", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hip Abduction Machine", "Máquina de Abducción", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Frog Pump", "Bombeo de Rana", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Dumbbell Sumo Squat", "Sentadilla Sumo con Mancuerna", MuscleGroup.GLUTES, "quadriceps,hamstrings", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Cable Lateral Kick", "Patada Lateral en Polea", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Banded Lateral Kick", "Patada Lateral con Polainas", MuscleGroup.GLUTES, None, ExerciseCategory.ISOLATION, "Bands"),

    # ── Calves ──
    ("Standing Calf Raise", "Elevación de Pantorrilla de Pie", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Seated Calf Raise", "Elevación de Pantorrilla Sentado", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Donkey Calf Raise", "Elevación de Pantorrilla Burro", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Leg Press Calf Raise", "Pantorrilla en Prensa", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Machine"),
    ("Single Leg Calf Raise", "Pantorrilla a una Pierna", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Smith Machine Calf Raise", "Pantorrilla en Smith", MuscleGroup.CALVES, None, ExerciseCategory.ISOLATION, "Smith Machine"),

    # ── Abs ──
    ("Cable Crunch", "Crunch con Cable", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Hanging Leg Raise", "Elevación de Piernas Colgado", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Ab Wheel Rollout", "Rueda Abdominal", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Ab Wheel"),
    ("Plank", "Plancha", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Russian Twist", "Giro Ruso", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Decline Crunch", "Crunch Declinado", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bench"),
    ("Bicycle Crunch", "Crunch Bicicleta", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Reverse Crunch", "Crunch Inverso", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("V-Up", "V-Up", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Dead Bug", "Bicho Muerto", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Pallof Press", "Press Pallof", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Woodchop", "Leñador", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Mountain Climbers", "Escaladores", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),
    ("Leg Raise", "Elevación de Piernas", MuscleGroup.ABS, None, ExerciseCategory.ISOLATION, "Bodyweight"),

    # ── Traps ──
    ("Barbell Shrug", "Encogimiento con Barra", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Dumbbell Shrug", "Encogimiento con Mancuernas", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Dumbbells"),
    ("Cable Shrug", "Encogimiento con Cable", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Cable"),
    ("Smith Machine Shrug", "Encogimiento en Smith", MuscleGroup.TRAPS, None, ExerciseCategory.ISOLATION, "Smith Machine"),

    # ── Forearms ──
    ("Wrist Curl", "Curl de Muñeca", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Reverse Wrist Curl", "Curl de Muñeca Inverso", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),
    ("Farmer's Walk", "Caminata del Granjero", MuscleGroup.FOREARMS, "traps", ExerciseCategory.COMPOUND, "Dumbbells"),
    ("Plate Pinch", "Pinza de Disco", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Plate"),
    ("Behind the Back Wrist Curl", "Curl de Muñeca por Detrás", MuscleGroup.FOREARMS, None, ExerciseCategory.ISOLATION, "Barbell"),

    # ── Cardio ──
    ("Treadmill Run", "Correr en Caminadora", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Treadmill"),
    ("Cycling", "Ciclismo Estacionario", MuscleGroup.CARDIO, None, ExerciseCategory.CARDIO, "Stationary Bike"),
    ("Rowing Machine", "Máquina de Remo", MuscleGroup.CARDIO, "back", ExerciseCategory.CARDIO, "Rowing Machine"),
    ("Jump Rope", "Saltar la Cuerda", MuscleGroup.CARDIO, "calves", ExerciseCategory.CARDIO, "Jump Rope"),
    ("Stair Climber", "Escaladora", MuscleGroup.CARDIO, "quadriceps,glutes", ExerciseCategory.CARDIO, "Machine"),
    ("Battle Ropes", "Cuerdas de Batalla", MuscleGroup.CARDIO, "shoulders,back", ExerciseCategory.CARDIO, "Battle Ropes"),
]

# Build a name→name_es lookup for updating existing exercises
_NAME_ES_MAP = {name: name_es for name, name_es, *_ in EXERCISES}

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
    """Add any missing exercises and update Spanish names."""
    existing = {e.name: e for e in db.query(Exercise).all()}

    added = 0
    updated = 0
    for name, name_es, muscle, secondary, category, equipment in EXERCISES:
        if name in existing:
            # Update name_es if missing
            ex = existing[name]
            if not ex.name_es and name_es:
                ex.name_es = name_es
                updated += 1
        else:
            db.add(Exercise(
                name=name,
                name_es=name_es,
                muscle_group=muscle,
                secondary_muscles=secondary,
                category=category,
                equipment=equipment,
            ))
            added += 1

    if added > 0 or updated > 0:
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
