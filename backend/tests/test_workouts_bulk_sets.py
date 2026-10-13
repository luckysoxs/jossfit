from tests.conftest import make_user
from app.models.workout import Workout, WorkoutSet
from app.models.one_rep_max import OneRepMax
from app.utils.timezone import today_mx


def _bulk(client, headers, sets):
    return client.post("/workouts/bulk-sets", headers=headers, json={"sets": sets})


def _series_de_hoy(db_session, user_id):
    w = (
        db_session.query(Workout)
        .filter(Workout.user_id == user_id, Workout.date == today_mx())
        .first()
    )
    if not w:
        return []
    return (
        db_session.query(WorkoutSet)
        .filter(WorkoutSet.workout_id == w.id)
        .order_by(WorkoutSet.set_number)
        .all()
    )


def test_guarda_todas_las_series_en_el_entreno_de_hoy(client, db_session, seed_exercises):
    u = make_user(client, "bulk1@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
        {"exercise_id": seed_exercises[1], "weight_kg": 100.0, "reps": 5},
    ])
    assert res.status_code == 201, res.text
    cuerpo = res.json()
    assert cuerpo["ok"] is True
    assert cuerpo["saved"] == 2

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert [s.set_number for s in series] == [1, 2]
    assert [s.exercise_id for s in series] == [seed_exercises[0], seed_exercises[1]]
    assert [s.weight_kg for s in series] == [80.0, 100.0]
    assert all(s.completed for s in series)


def test_reutiliza_el_entreno_de_hoy_y_sigue_la_numeracion(client, db_session, seed_exercises):
    u = make_user(client, "bulk2@test.com")
    primera = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 60.0, "reps": 10},
    ])
    segunda = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[1], "weight_kg": 70.0, "reps": 9},
    ])
    assert segunda.status_code == 201, segunda.text
    assert primera.json()["workout_id"] == segunda.json()["workout_id"]

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert [s.set_number for s in series] == [1, 2]


def test_peso_cero_se_guarda_y_no_crea_1rm(client, db_session, seed_exercises):
    """Dominadas, fondos y plancha: 0 kg es el peso real."""
    u = make_user(client, "bulk3@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 0.0, "reps": 10},
    ])
    assert res.status_code == 201, res.text

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert len(series) == 1
    assert series[0].weight_kg == 0.0

    rms = db_session.query(OneRepMax).filter(OneRepMax.user_id == u["user"]["id"]).all()
    assert rms == []


def test_con_peso_y_pocas_reps_crea_1rm(client, db_session, seed_exercises):
    u = make_user(client, "bulk4@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 100.0, "reps": 5},
    ])
    assert res.status_code == 201, res.text

    rms = db_session.query(OneRepMax).filter(OneRepMax.user_id == u["user"]["id"]).all()
    assert len(rms) == 1
    assert rms[0].exercise_id == seed_exercises[0]
    assert rms[0].source_weight == 100.0
    assert rms[0].source_reps == 5


def test_lista_vacia_da_400(client, db_session):
    u = make_user(client, "bulk5@test.com")
    res = _bulk(client, u["headers"], [])
    assert res.status_code == 400
    assert res.json()["detail"] == "No hay series para guardar"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_demasiadas_series_da_400(client, db_session, seed_exercises):
    u = make_user(client, "bulk6@test.com")
    sets = [{"exercise_id": seed_exercises[0], "weight_kg": 50.0, "reps": 10}] * 51
    res = _bulk(client, u["headers"], sets)
    assert res.status_code == 400
    assert res.json()["detail"] == "Demasiadas series en una sola peticion"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_reps_invalidas_no_guardan_nada(client, db_session, seed_exercises):
    """La validacion corre antes de insertar: nada queda a medias."""
    u = make_user(client, "bulk7@test.com")
    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
        {"exercise_id": seed_exercises[1], "weight_kg": 90.0, "reps": 0},
    ])
    assert res.status_code == 400
    assert res.json()["detail"] == "Peso o repeticiones invalidos"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_peso_negativo_no_guarda_nada(client, db_session, seed_exercises):
    u = make_user(client, "bulk8@test.com")
    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": -5.0, "reps": 8},
    ])
    assert res.status_code == 400
    assert res.json()["detail"] == "Peso o repeticiones invalidos"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_sin_token_da_401(client, seed_exercises):
    res = client.post("/workouts/bulk-sets", json={
        "sets": [{"exercise_id": seed_exercises[0], "weight_kg": 50.0, "reps": 10}],
    })
    assert res.status_code == 401


def test_las_series_guardadas_alimentan_last_sets(client, seed_exercises):
    """Lo que se marca de golpe es lo que la proxima vez sale como ultima vez."""
    u = make_user(client, "bulk9@test.com")
    _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 82.5, "reps": 7},
    ])

    res = client.get("/workouts/last-sets", headers=u["headers"])
    por_ex = {item["exercise_id"]: item for item in res.json()}
    assert por_ex[seed_exercises[0]]["weight_kg"] == 82.5
    assert por_ex[seed_exercises[0]]["reps"] == 7
