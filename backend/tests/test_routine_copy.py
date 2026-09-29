from tests.conftest import make_user
from app.models.routine import Routine
from app.models.user import User
from app.services.routine_copy import copy_routine


def _rutina_con_superserie(client, headers, ejercicios, name="Original"):
    """Rutina de 2 dias; en el dia 1 los dos primeros ejercicios son superserie."""
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "upper_lower",
        "objective": "hypertrophy", "days_per_week": 2,
        "days": [
            {"day_number": 1, "name": "Dia 1", "focus": "upper", "exercises": [
                {"exercise_id": ejercicios[0], "order": 1, "sets": 4,
                 "reps_min": 6, "reps_max": 8, "rest_seconds": 120, "notes": "Pesado"},
                {"exercise_id": ejercicios[2], "order": 2, "sets": 3,
                 "reps_min": 10, "reps_max": 12, "rest_seconds": 60},
                {"exercise_id": ejercicios[1], "order": 3, "sets": 3,
                 "reps_min": 8, "reps_max": 10, "rest_seconds": 90},
            ]},
            {"day_number": 2, "name": "Dia 2", "focus": "lower", "exercises": [
                {"exercise_id": ejercicios[1], "order": 1, "sets": 5,
                 "reps_min": 3, "reps_max": 5, "rest_seconds": 180},
            ]},
        ],
    })
    assert res.status_code == 201, res.text
    rutina = res.json()
    dia1 = rutina["days"][0]["exercises"] if rutina["days"][0]["day_number"] == 1 else rutina["days"][1]["exercises"]
    ids = [e["id"] for e in sorted(dia1, key=lambda e: e["order"])][:2]
    res = client.put("/routines/exercises/link", headers=headers, json={"exercise_ids": ids})
    assert res.status_code == 200, res.text
    return rutina["id"]


def _foto(routine: Routine):
    """Contenido comparable de una rutina, sin IDs."""
    return [
        (d.day_number, d.name, d.focus, [
            (e.exercise_id, e.order, e.sets, e.reps_min, e.reps_max, e.rest_seconds, e.notes)
            for e in sorted(d.exercises, key=lambda e: e.order)
        ])
        for d in sorted(routine.days, key=lambda d: d.day_number)
    ]


def test_copia_todo_el_contenido(client, db_session, seed_exercises):
    u = make_user(client, "copia1@test.com")
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    db_session.query(Routine).filter(Routine.id == rid).update({"rest_weekdays": [6]})
    db_session.commit()
    source = db_session.get(Routine, rid)
    owner = db_session.get(User, u["user"]["id"])

    copia = copy_routine(db_session, source, owner, "Nueva", as_template=True)
    db_session.commit()

    assert copia.id != source.id
    assert copia.user_id == owner.id
    assert copia.name == "Nueva"
    assert copia.is_template is True
    assert copia.split_type == "upper_lower"
    assert copia.objective == "hypertrophy"
    assert copia.days_per_week == 2
    assert copia.rest_weekdays == [6]
    assert _foto(copia) == _foto(source)
    ids_orig = {e.id for d in source.days for e in d.exercises}
    ids_copia = {e.id for d in copia.days for e in d.exercises}
    assert ids_orig.isdisjoint(ids_copia)


def test_superserie_remapeada(client, db_session, seed_exercises):
    u = make_user(client, "copia2@test.com")
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    source = db_session.get(Routine, rid)
    owner = db_session.get(User, u["user"]["id"])

    copia = copy_routine(db_session, source, owner, None, as_template=False)
    db_session.commit()

    def grupos(r):
        dia1 = next(d for d in r.days if d.day_number == 1)
        return [e.group_id for e in sorted(dia1.exercises, key=lambda e: e.order)]

    g_orig, g_copia = grupos(source), grupos(copia)
    assert g_orig[0] is not None and g_orig[0] == g_orig[1] and g_orig[2] is None
    assert g_copia[0] is not None and g_copia[0] == g_copia[1] and g_copia[2] is None
    assert g_copia[0] != g_orig[0]


def test_nombre_por_defecto_y_recorte(client, db_session, seed_exercises):
    u = make_user(client, "copia3@test.com")
    owner = db_session.get(User, u["user"]["id"])
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises, name="Pierna")
    source = db_session.get(Routine, rid)

    assert copy_routine(db_session, source, owner, None, False).name == "Pierna (copia)"
    assert copy_routine(db_session, source, owner, "   ", False).name == "Pierna (copia)"
    assert copy_routine(db_session, source, owner, "  Mia  ", False).name == "Mia"
    assert len(copy_routine(db_session, source, owner, "x" * 150, False).name) == 100

    largo = _rutina_con_superserie(client, u["headers"], seed_exercises, name="y" * 100)
    source_largo = db_session.get(Routine, largo)
    nombre = copy_routine(db_session, source_largo, owner, None, False).name
    assert nombre.endswith(" (copia)")
    assert len(nombre) == 100
    assert nombre == "y" * 92 + " (copia)"


AI_DATA = {
    "perfil": {"riesgo_global": "alto", "alertas": ["hipertension"]},
    "rutina": [{"dia": 1, "ejercicios": ["sentadilla", "press"]}],
}


def test_ai_data_se_descarta_al_publicar_a_clientes(client, db_session, seed_exercises):
    u = make_user(client, "copia4@test.com")
    owner = db_session.get(User, u["user"]["id"])
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    db_session.query(Routine).filter(Routine.id == rid).update(
        {"generation_type": "adaptativo", "ai_data": AI_DATA})
    db_session.commit()
    source = db_session.get(Routine, rid)

    copia = copy_routine(db_session, source, owner, "Para clientes", as_template=True)
    db_session.commit()

    assert copia.ai_data is None
    assert copia.generation_type == "normal"
    assert source.ai_data == AI_DATA
    assert source.generation_type == "adaptativo"


def test_ai_data_se_conserva_y_es_independiente_en_personal(client, db_session, seed_exercises):
    u = make_user(client, "copia5@test.com")
    owner = db_session.get(User, u["user"]["id"])
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    db_session.query(Routine).filter(Routine.id == rid).update(
        {"generation_type": "adaptativo", "ai_data": AI_DATA})
    db_session.commit()
    source = db_session.get(Routine, rid)

    copia = copy_routine(db_session, source, owner, None, as_template=False)
    db_session.commit()

    assert copia.generation_type == "adaptativo"
    assert copia.ai_data == AI_DATA
    assert copia.ai_data is not source.ai_data

    copia.ai_data["perfil"]["riesgo_global"] = "bajo"
    assert source.ai_data["perfil"]["riesgo_global"] == "alto"
