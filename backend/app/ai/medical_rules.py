"""Medical rules engine for adaptive routine generation.

Implements all 15 pathologies, 7 medication categories, and mobility
limitation substitutions from the JOSSFITness clinical ruleset.
"""

# ── Pathology Rules ─────────────────────────────────────────────
# Each pathology defines adjustments to exercise parameters
PATHOLOGY_RULES = {
    "diabetes_t1": {
        "label": "Diabetes Tipo 1",
        "max_rpe": 7,
        "volume_multiplier": 0.9,
        "rest_multiplier": 1.0,
        "warmup_duration": 10,
        "avoid_fasting_exercise": True,
        "prefer_moderate_over_hiit": True,
        "safety_notes": [
            "Monitorear glucosa pre/post entrenamiento",
            "No entrenar si glucosa <70 o >250 mg/dL",
            "Tener carbohidratos de rápida absorción disponibles",
        ],
        "alerts": [
            "Señal de alerta: hipoglucemia (temblor, sudoración fría, confusión)",
            "Preferir ejercicio moderado sostenido sobre HIIT extremo",
        ],
    },
    "diabetes_t2": {
        "label": "Diabetes Tipo 2",
        "max_rpe": 7,
        "volume_multiplier": 0.9,
        "rest_multiplier": 1.0,
        "warmup_duration": 10,
        "avoid_fasting_exercise": True,
        "prefer_moderate_over_hiit": True,
        "safety_notes": [
            "Monitorear glucosa pre/post entrenamiento",
            "No entrenar si glucosa <70 o >250 mg/dL",
            "Tener carbohidratos de rápida absorción disponibles",
        ],
        "alerts": [
            "Señal de alerta: hipoglucemia (temblor, sudoración fría, confusión)",
            "Preferir ejercicio moderado sostenido sobre HIIT extremo",
        ],
    },
    "sarcopenia": {
        "label": "Sarcopenia",
        "max_rpe": 8,
        "volume_multiplier": 1.0,
        "rest_multiplier": 1.2,
        "warmup_duration": 10,
        "prefer_strength": True,
        "tempo": "3-1-2",
        "safety_notes": [
            "Priorizar fuerza con cargas progresivas",
            "Series de 8-12 reps con tempo controlado (3-1-2)",
            "Incluir ejercicios de equilibrio",
            "Proteína alta post-entreno",
        ],
        "alerts": [
            "Incrementar carga gradualmente semana a semana",
            "Priorizar ejercicios compuestos sobre aislamiento",
        ],
    },
    "perdida_muscular_medicamentos": {
        "label": "Pérdida muscular por medicamentos",
        "max_rpe": 6,
        "volume_multiplier": 0.6,
        "rest_multiplier": 1.5,
        "warmup_duration": 10,
        "safety_notes": [
            "Volumen reducido 30-40%",
            "Monitorear dolor muscular inusual",
            "Descansos más largos entre series",
            "Priorizar compuestos sobre aislamiento",
        ],
        "alerts": [
            "Señal de alerta: dolor muscular severo o inusual (posible rabdomiólisis)",
            "Reportar inmediatamente orina oscura o debilidad extrema",
        ],
    },
    "artritis_reumatoide": {
        "label": "Artritis Reumatoide / Lupus",
        "max_rpe": 5,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.5,
        "warmup_duration": 15,
        "no_high_impact": True,
        "safety_notes": [
            "Evitar ejercicio en brotes activos",
            "ROM completo sin carga en fase inflamatoria",
            "Hidroterapia como alternativa",
            "Calentamiento extendido (10-15 min)",
        ],
        "alerts": [
            "No entrenar durante brotes inflamatorios activos",
            "Evitar impacto alto y cargas excesivas en articulaciones",
        ],
    },
    "lupus": {
        "label": "Lupus Eritematoso",
        "max_rpe": 5,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.5,
        "warmup_duration": 15,
        "no_high_impact": True,
        "safety_notes": [
            "Evitar ejercicio en brotes activos",
            "ROM completo sin carga en fase inflamatoria",
            "Calentamiento extendido (10-15 min)",
        ],
        "alerts": [
            "No entrenar durante brotes inflamatorios activos",
            "Evitar exposición solar prolongada durante ejercicio al aire libre",
        ],
    },
    "esclerosis_multiple": {
        "label": "Esclerosis Múltiple",
        "max_rpe": 6,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.5,
        "warmup_duration": 10,
        "max_session_minutes": 45,
        "safety_notes": [
            "Evitar sobrecalentamiento (fenómeno Uhthoff)",
            "Sesiones cortas (<45 min)",
            "Incluir ejercicios de equilibrio y coordinación",
            "Descansos frecuentes",
        ],
        "alerts": [
            "Señal de alerta: empeoramiento de síntomas neurológicos con el calor",
            "Entrenar en ambiente fresco, hidratación constante",
        ],
    },
    "epoc": {
        "label": "EPOC",
        "max_rpe": 6,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.5,
        "warmup_duration": 10,
        "safety_notes": [
            "Mantener RPE ≤6/10",
            "Incluir ejercicios respiratorios",
            "Ejercicio de tren superior con respiración coordinada",
            "Descansos de 2-3 min entre series",
        ],
        "alerts": [
            "Señal de alerta: disnea severa, SpO2 <88%",
            "Detener ejercicio si hay dificultad respiratoria severa",
        ],
    },
    "caquexia_oncologica": {
        "label": "Caquexia Oncológica",
        "max_rpe": 4,
        "volume_multiplier": 0.5,
        "rest_multiplier": 2.0,
        "warmup_duration": 10,
        "max_session_minutes": 30,
        "safety_notes": [
            "Intensidad muy baja",
            "Priorizar movimiento funcional y calidad de vida",
            "RPE máximo 4-5/10",
            "Sesiones de 20-30 min máximo",
        ],
        "alerts": [
            "Requiere supervisión médica obligatoria",
            "Ajustar según tolerancia del día",
        ],
    },
    "insuficiencia_renal": {
        "label": "Insuficiencia Renal",
        "max_rpe": 6,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.3,
        "warmup_duration": 10,
        "safety_notes": [
            "Considerar restricción proteica según indicación médica",
            "Evitar ejercicio en días de diálisis o post-diálisis inmediata",
            "Hidratación controlada",
        ],
        "alerts": [
            "Consultar con nefrólogo sobre ingesta proteica post-ejercicio",
            "No entrenar inmediatamente después de diálisis",
        ],
    },
    "vih_sida": {
        "label": "VIH/SIDA",
        "max_rpe": 7,
        "volume_multiplier": 0.8,
        "rest_multiplier": 1.2,
        "warmup_duration": 10,
        "safety_notes": [
            "Entrenamiento de resistencia para contrarrestar wasting",
            "Monitorear fatiga",
            "Considerar interacción con antirretrovirales",
            "Progresión gradual",
        ],
        "alerts": [
            "Ajustar intensidad según estado inmunológico",
            "Reportar fatiga inusual al médico",
        ],
    },
    "post_quirurgico": {
        "label": "Post-Quirúrgico / Inmovilización",
        "max_rpe": 5,
        "volume_multiplier": 0.5,
        "rest_multiplier": 1.5,
        "warmup_duration": 15,
        "safety_notes": [
            "Fases: movilidad → estabilidad → fuerza → funcional",
            "Respetar protocolos de rehabilitación",
            "No cargar zona operada sin autorización médica",
        ],
        "alerts": [
            "Requiere autorización médica para progresión de carga",
            "Respetar tiempos de recuperación del procedimiento",
        ],
    },
    "fibromialgia": {
        "label": "Fibromialgia",
        "max_rpe": 5,
        "volume_multiplier": 0.6,
        "rest_multiplier": 1.5,
        "warmup_duration": 15,
        "safety_notes": [
            "Intensidad baja-moderada",
            "Incluir estiramientos y movilidad",
            "Evitar exceso de volumen",
            "Ejercicio aeróbico suave (caminar, nadar)",
            "Progresión muy lenta",
        ],
        "alerts": [
            "Ajustar según nivel de dolor del día",
            "No forzar en días de brote",
        ],
    },
    "parkinson": {
        "label": "Parkinson",
        "max_rpe": 6,
        "volume_multiplier": 0.7,
        "rest_multiplier": 1.3,
        "warmup_duration": 15,
        "safety_notes": [
            "Ejercicios de amplitud de movimiento grande",
            "Incluir coordinación y equilibrio",
            "Movimientos rítmicos",
            "Entrenamiento de marcha",
        ],
        "alerts": [
            "Supervisión para ejercicios de equilibrio",
            "Usar apoyos/agarres para seguridad",
        ],
    },
    "insuficiencia_cardiaca": {
        "label": "Insuficiencia Cardíaca",
        "max_rpe": 5,
        "volume_multiplier": 0.6,
        "rest_multiplier": 1.5,
        "warmup_duration": 15,
        "safety_notes": [
            "RPE ≤5/10",
            "Monitorear FC y síntomas",
            "No Valsalva",
            "Evitar isométricos prolongados",
        ],
        "alerts": [
            "Requiere supervisión médica obligatoria",
            "Señal de alerta: dolor de pecho, mareo, disnea súbita",
            "Detener inmediatamente ante cualquier síntoma cardíaco",
        ],
    },
    "osteoporosis": {
        "label": "Osteoporosis",
        "max_rpe": 7,
        "volume_multiplier": 0.8,
        "rest_multiplier": 1.2,
        "warmup_duration": 10,
        "include_axial_loading": True,
        "no_high_impact": True,
        "safety_notes": [
            "Incluir carga axial (caminar, sentadilla asistida)",
            "Evitar flexión espinal con carga",
            "No impacto alto en osteoporosis severa",
            "Ejercicios de equilibrio para prevención de caídas",
        ],
        "alerts": [
            "Evitar movimientos bruscos y flexión espinal con peso",
            "Priorizar estabilidad y prevención de caídas",
        ],
    },
    "depresion_ansiedad": {
        "label": "Depresión / Ansiedad",
        "max_rpe": 8,
        "volume_multiplier": 1.0,
        "rest_multiplier": 1.0,
        "warmup_duration": 10,
        "include_aerobic": True,
        "safety_notes": [
            "Incluir componente aeróbico (liberación de endorfinas)",
            "Sesiones estructuradas pero flexibles",
            "Progresión basada en adherencia, no en rendimiento",
        ],
        "alerts": [
            "Priorizar consistencia sobre intensidad",
            "El ejercicio es complemento, no sustituto del tratamiento",
        ],
    },
    "hipertension": {
        "label": "Hipertensión",
        "max_rpe": 6,
        "volume_multiplier": 0.85,
        "rest_multiplier": 1.3,
        "warmup_duration": 10,
        "safety_notes": [
            "Evitar maniobra de Valsalva",
            "Evitar isométricos prolongados",
            "Preferir cargas moderadas con más repeticiones",
            "Incluir ejercicio aeróbico",
        ],
        "alerts": [
            "Monitorear presión arterial antes de entrenar",
            "No entrenar si PA >180/110 mmHg",
        ],
    },
}

# ── Medication Rules ────────────────────────────────────────────
MEDICATION_RULES = {
    "corticosteroides": {
        "label": "Corticosteroides",
        "volume_multiplier": 0.8,
        "notes": [
            "Riesgo de osteoporosis y miopatía por uso prolongado",
            "Reducir impacto",
            "Incluir carga ósea (ejercicios de peso corporal, sentadillas)",
        ],
    },
    "estatinas": {
        "label": "Estatinas (Atorvastatina, Rosuvastatina, etc.)",
        "volume_multiplier": 0.8,
        "notes": [
            "Monitorear mialgia (dolor muscular)",
            "Si hay dolor muscular, reducir intensidad",
            "Señal de alerta: orina oscura = posible rabdomiólisis → urgencias",
        ],
    },
    "insulina": {
        "label": "Insulina",
        "volume_multiplier": 1.0,
        "notes": [
            "Ajustar timing de ejercicio vs inyección",
            "Tener carbohidratos disponibles",
            "Monitorear glucosa antes y después del ejercicio",
        ],
    },
    "beta_bloqueadores": {
        "label": "Beta-bloqueadores (Metoprolol, Atenolol, etc.)",
        "volume_multiplier": 0.9,
        "use_rpe_not_hr": True,
        "notes": [
            "NO usar frecuencia cardíaca como indicador de intensidad (está suprimida)",
            "Usar RPE (escala de esfuerzo percibido) en su lugar",
            "Puede causar fatiga y mareo al inicio",
        ],
    },
    "anticoagulantes": {
        "label": "Anticoagulantes (Warfarina, Rivaroxabán, etc.)",
        "volume_multiplier": 0.9,
        "avoid_contact": True,
        "notes": [
            "Evitar deportes de contacto",
            "Cuidado con caídas",
            "No ejercicios con alto riesgo de golpe",
            "Reportar moretones inusuales",
        ],
    },
    "quimioterapia": {
        "label": "Quimioterapia",
        "volume_multiplier": 0.5,
        "notes": [
            "Días post-quimio = descanso obligatorio",
            "Entrenar solo en días de mejor energía",
            "Volumen mínimo, escuchar al cuerpo",
            "Priorizar calidad de vida sobre rendimiento",
        ],
    },
    "anticonvulsivos": {
        "label": "Anticonvulsivos",
        "volume_multiplier": 0.85,
        "notes": [
            "Pueden causar somnolencia y problemas de coordinación",
            "Evitar ejercicios complejos de equilibrio sin apoyo",
            "Usar máquinas guiadas cuando sea posible",
        ],
    },
    "metformina": {
        "label": "Metformina",
        "volume_multiplier": 1.0,
        "notes": [
            "Generalmente segura con ejercicio",
            "Monitorear glucosa si se combina con insulina",
            "Puede causar malestar gastrointestinal",
        ],
    },
    "antidepresivos": {
        "label": "Antidepresivos",
        "volume_multiplier": 1.0,
        "notes": [
            "Pueden causar mareo o somnolencia al inicio",
            "Hidratación adecuada",
            "El ejercicio potencia el efecto del tratamiento",
        ],
    },
    "antihipertensivos": {
        "label": "Antihipertensivos",
        "volume_multiplier": 0.9,
        "notes": [
            "Pueden causar hipotensión postural",
            "Levantarse despacio después de ejercicios en suelo",
            "Hidratación adecuada",
        ],
    },
}

# ── Mobility Limitation Substitutions ───────────────────────────
LIMITATION_ZONES = {
    "hombro": {
        "label": "Hombro",
        "avoid_patterns": ["press militar", "press overhead", "dominadas", "pull up", "elevaciones laterales con peso alto"],
        "prefer_alternatives": ["landmine press", "press en máquina", "elevaciones laterales ligeras", "face pull con banda"],
        "prehab": ["rotación externa con banda", "dislocaciones con banda elástica", "wall slides"],
    },
    "rodilla": {
        "label": "Rodilla",
        "avoid_patterns": ["sentadilla profunda", "zancadas", "extensión de pierna con peso alto", "saltos"],
        "prefer_alternatives": ["sentadilla a cajón", "prensa de pierna (ROM limitado)", "puente de glúteo", "step-up bajo"],
        "prehab": ["extensión de rodilla isométrica", "mini sentadilla isométrica", "movilidad de rótula"],
    },
    "espalda_baja": {
        "label": "Espalda Baja",
        "avoid_patterns": ["peso muerto convencional", "buenos días", "hiperextensiones con peso", "sentadilla con barra alta"],
        "prefer_alternatives": ["peso muerto rumano ligero", "hip thrust", "sentadilla goblet", "bird dog"],
        "prehab": ["cat-cow", "dead bug", "plancha abdominal", "movilidad de cadera"],
    },
    "muñeca": {
        "label": "Muñeca",
        "avoid_patterns": ["flexiones en suelo", "front squat con barra", "curl de muñeca pesado"],
        "prefer_alternatives": ["flexiones en puños o con barras", "front squat con straps", "curl con mancuerna neutra"],
        "prehab": ["extensión y flexión de muñeca con banda", "rotaciones de muñeca"],
    },
    "codo": {
        "label": "Codo",
        "avoid_patterns": ["curl de bíceps pesado", "extensión de tríceps con barra", "press francés"],
        "prefer_alternatives": ["curl con agarre neutro", "extensión de tríceps con cuerda", "press cerrado"],
        "prehab": ["extensiones de muñeca", "pronación/supinación con mancuerna ligera"],
    },
    "tobillo": {
        "label": "Tobillo",
        "avoid_patterns": ["saltos", "sentadilla profunda sin tacón", "sprints"],
        "prefer_alternatives": ["sentadilla con tacón elevado", "prensa de pierna", "bicicleta estática"],
        "prehab": ["dorsiflexión en pared", "circulos de tobillo", "balance en una pierna"],
    },
    "cadera": {
        "label": "Cadera",
        "avoid_patterns": ["sentadilla sumo profunda", "abducción pesada", "zancadas largas"],
        "prefer_alternatives": ["sentadilla parcial", "puente de glúteo", "abducción con banda ligera", "step-up"],
        "prehab": ["clamshell", "movilidad 90/90", "círculos de cadera"],
    },
    "cuello": {
        "label": "Cuello",
        "avoid_patterns": ["encogimientos pesados", "press militar detrás del cuello"],
        "prefer_alternatives": ["encogimientos ligeros", "press militar frontal", "elevaciones de trapecios con mancuerna"],
        "prehab": ["retracción cervical", "rotaciones suaves de cuello"],
    },
}


# ── Helper Functions ────────────────────────────────────────────

def calculate_risk_level(
    pathologies: list[str] | None,
    medications: list[str] | None,
    age: int,
) -> str:
    """Calculate global risk level based on conditions."""
    if not pathologies:
        return "bajo"

    critical_conditions = {"caquexia_oncologica", "insuficiencia_cardiaca"}
    high_risk_conditions = {
        "post_quirurgico", "esclerosis_multiple", "epoc",
        "insuficiencia_renal",
    }

    path_set = set(pathologies)

    if path_set & critical_conditions:
        return "critico"

    score = 0
    if path_set & high_risk_conditions:
        score += 3
    score += len(pathologies)
    if medications:
        score += len(medications) * 0.5
    if age >= 65:
        score += 2
    elif age >= 50:
        score += 1

    if score >= 6:
        return "alto"
    elif score >= 3:
        return "medio"
    return "bajo"


def get_safety_alerts(
    pathologies: list[str] | None,
    medications: list[str] | None,
) -> list[str]:
    """Collect all safety alerts from active pathologies and medications."""
    alerts = []
    for p in (pathologies or []):
        rule = PATHOLOGY_RULES.get(p, {})
        alerts.extend(rule.get("alerts", []))
    for m in (medications or []):
        m_key = m.lower().replace(" ", "_")
        rule = MEDICATION_RULES.get(m_key, {})
        alerts.extend(rule.get("notes", []))
    return alerts


def get_combined_multipliers(
    pathologies: list[str] | None,
    medications: list[str] | None,
) -> dict:
    """Get the most restrictive multipliers from all conditions."""
    min_rpe = 10
    min_volume = 1.0
    max_rest = 1.0
    max_warmup = 10

    for p in (pathologies or []):
        rule = PATHOLOGY_RULES.get(p, {})
        min_rpe = min(min_rpe, rule.get("max_rpe", 10))
        min_volume = min(min_volume, rule.get("volume_multiplier", 1.0))
        max_rest = max(max_rest, rule.get("rest_multiplier", 1.0))
        max_warmup = max(max_warmup, rule.get("warmup_duration", 10))

    for m in (medications or []):
        m_key = m.lower().replace(" ", "_")
        rule = MEDICATION_RULES.get(m_key, {})
        min_volume = min(min_volume, rule.get("volume_multiplier", 1.0))

    return {
        "max_rpe": min_rpe,
        "volume_multiplier": min_volume,
        "rest_multiplier": max_rest,
        "warmup_duration": max_warmup,
    }


def get_safety_notes_for_exercise(
    muscle_group: str,
    pathologies: list[str] | None,
) -> str | None:
    """Get relevant safety notes for a specific exercise context."""
    notes = []
    for p in (pathologies or []):
        rule = PATHOLOGY_RULES.get(p, {})
        for note in rule.get("safety_notes", []):
            if note not in notes:
                notes.append(note)
    return "; ".join(notes[:2]) if notes else None


def get_disclaimer(risk_level: str) -> str | None:
    """Get the appropriate disclaimer based on risk level."""
    if risk_level == "critico":
        return (
            "IMPORTANTE: Tu perfil de salud requiere supervisión médica presencial "
            "para realizar esta rutina. Consulta con tu médico antes de iniciar. "
            "JOSSFITness es una guía, no sustituye la opinión profesional médica."
        )
    if risk_level in ("alto", "medio"):
        return (
            "Esta rutina ha sido adaptada a tus condiciones de salud. "
            "Consulta con tu médico antes de iniciar cualquier programa de ejercicio. "
            "JOSSFITness es una guía, no sustituye la opinión profesional médica."
        )
    return None


def get_limitation_info(limitations: list[str] | None) -> dict:
    """Get avoidance patterns and alternatives for mobility limitations."""
    avoid = []
    alternatives = []
    prehab = []

    for lim in (limitations or []):
        lim_key = lim.lower().replace(" ", "_")
        # Try to match by zone keyword
        for zone_key, zone_data in LIMITATION_ZONES.items():
            if zone_key in lim_key or lim_key in zone_key:
                avoid.extend(zone_data.get("avoid_patterns", []))
                alternatives.extend(zone_data.get("prefer_alternatives", []))
                prehab.extend(zone_data.get("prehab", []))
                break

    return {
        "avoid_patterns": list(set(avoid)),
        "alternatives": list(set(alternatives)),
        "prehab": list(set(prehab)),
    }


# ── Warmup / Cooldown / Cardio Templates ────────────────────────

def get_warmup(warmup_duration: int, pathologies: list[str] | None) -> dict:
    """Generate warmup based on conditions."""
    exercises = ["Movilidad articular general (círculos de brazos, rodillas, tobillos)"]

    if warmup_duration >= 12:
        exercises.append("Caminata suave 3-5 min")
    else:
        exercises.append("Caminata suave 2-3 min")

    exercises.append("Activación muscular con bandas elásticas")

    path_set = set(pathologies or [])
    if path_set & {"artritis_reumatoide", "lupus", "fibromialgia"}:
        exercises.append("Estiramientos dinámicos suaves (sin rebote)")
    if path_set & {"epoc"}:
        exercises.append("Ejercicios de respiración diafragmática")
    if path_set & {"parkinson"}:
        exercises.append("Ejercicios de coordinación y ritmo")

    return {"duracion": warmup_duration, "ejercicios": exercises}


def get_cooldown(pathologies: list[str] | None) -> dict:
    """Generate cooldown stretches."""
    exercises = [
        "Estiramiento de cuádriceps (30s cada pierna)",
        "Estiramiento de isquiotibiales (30s cada pierna)",
        "Estiramiento de pecho en marco de puerta (30s)",
        "Estiramiento de espalda (cat-cow, 30s)",
    ]

    path_set = set(pathologies or [])
    if path_set & {"fibromialgia", "artritis_reumatoide"}:
        exercises.append("Respiración profunda y relajación (2 min)")
    if path_set & {"depresion_ansiedad"}:
        exercises.append("Respiración 4-7-8 para relajación (2 min)")

    return {"duracion": 5, "ejercicios": exercises}


def get_cardio_recommendation(
    pathologies: list[str] | None,
    objective: str,
) -> dict:
    """Generate cardio recommendation based on conditions and objective."""
    path_set = set(pathologies or [])

    # Default cardio
    cardio = {
        "tipo": "Caminata en inclinación",
        "duracion": 20,
        "intensidad": "moderada",
        "notas": None,
    }

    if path_set & {"insuficiencia_cardiaca", "epoc"}:
        cardio["tipo"] = "Caminata suave"
        cardio["duracion"] = 10
        cardio["intensidad"] = "baja"
        cardio["notas"] = "Monitorear síntomas constantemente"
    elif path_set & {"caquexia_oncologica"}:
        cardio["tipo"] = "Caminata suave o bicicleta estática"
        cardio["duracion"] = 10
        cardio["intensidad"] = "muy baja"
    elif path_set & {"fibromialgia"}:
        cardio["tipo"] = "Caminata suave o natación"
        cardio["duracion"] = 15
        cardio["intensidad"] = "baja-moderada"
    elif objective in ("fat_loss", "endurance"):
        cardio["duracion"] = 25
    elif path_set & {"depresion_ansiedad"}:
        cardio["tipo"] = "Caminata rápida o trote suave"
        cardio["duracion"] = 20
        cardio["notas"] = "El ejercicio aeróbico ayuda a liberar endorfinas"

    return cardio


def get_nutrition_recommendation(
    objective: str,
    weight_kg: float,
    pathologies: list[str] | None,
) -> dict:
    """Generate basic nutrition recommendations."""
    path_set = set(pathologies or [])

    # Base protein per kg
    if objective in ("hypertrophy", "muscle_gain", "strength"):
        protein_range = "1.6-2.2"
    elif objective == "fat_loss":
        protein_range = "1.8-2.4"
    else:
        protein_range = "1.4-1.8"

    # Base calories estimate (very rough)
    base_cal = int(weight_kg * 30)
    if objective in ("hypertrophy", "muscle_gain"):
        cal_range = f"{base_cal}-{base_cal + 300}"
    elif objective == "fat_loss":
        cal_range = f"{base_cal - 400}-{base_cal - 200}"
    else:
        cal_range = f"{base_cal - 100}-{base_cal + 100}"

    supplements = ["Creatina Monohidrato 5g/día", "Proteína Whey post-entreno"]
    restrictions = []

    if path_set & {"insuficiencia_renal"}:
        protein_range = "0.8-1.2"
        restrictions.append("Proteína limitada por indicación médica renal")
        supplements = ["Consultar suplementación con nefrólogo"]
    if path_set & {"diabetes_t1", "diabetes_t2"}:
        restrictions.append("Controlar ingesta de carbohidratos simples")
    if path_set & {"insuficiencia_cardiaca", "hipertension"}:
        restrictions.append("Reducir sodio en la dieta")
    if path_set & {"caquexia_oncologica"}:
        protein_range = "1.2-1.5"
        restrictions.append("Priorizar densidad calórica, consultar oncólogo")

    return {
        "calorias_sugeridas": cal_range,
        "proteina_g_kg": protein_range,
        "suplementos": supplements,
        "restricciones": restrictions,
    }
