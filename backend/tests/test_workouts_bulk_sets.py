from datetime import timedelta

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


def test_respeta_la_fecha_que_manda_el_cliente(client, db_session, seed_exercises):
    """Lo encolado sin internet debe caer en el dia en que se marco."""
    u = make_user(client, "bulk10@test.com")
    ayer = today_mx() - timedelta(days=1)

    res = client.post("/workouts/bulk-sets", headers=u["headers"], json={
        "date": ayer.isoformat(),
        "sets": [{"exercise_id": seed_exercises[0], "weight_kg": 70.0, "reps": 8}],
    })
    assert res.status_code == 201, res.text

    assert _series_de_hoy(db_session, u["user"]["id"]) == []
    w = (
        db_session.query(Workout)
        .filter(Workout.user_id == u["user"]["id"], Workout.date == ayer)
        .first()
    )
    assert w is not None
    series = db_session.query(WorkoutSet).filter(WorkoutSet.workout_id == w.id).all()
    assert len(series) == 1
    assert series[0].weight_kg == 70.0

    rm = db_session.query(OneRepMax).filter(OneRepMax.user_id == u["user"]["id"]).first()
    assert rm.date == ayer


def test_fecha_futura_se_recorta_a_hoy(client, db_session, seed_exercises):
    """Un telefono en otra zona puede ir un dia adelante de la hora de Mexico:
    mejor registrar hoy que negarle el guardado."""
    u = make_user(client, "bulk11@test.com")
    manana = today_mx() + timedelta(days=1)

    res = client.post("/workouts/bulk-sets", headers=u["headers"], json={
        "date": manana.isoformat(),
        "sets": [{"exercise_id": seed_exercises[0], "weight_kg": 70.0, "reps": 8}],
    })
    assert res.status_code == 201, res.text

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert [s.weight_kg for s in series] == [70.0]
    assert (
        db_session.query(Workout)
        .filter(Workout.user_id == u["user"]["id"], Workout.date == manana)
        .first()
    ) is None


def test_ejercicio_inexistente_da_400_no_500(client, db_session, seed_exercises):
    """En Postgres la llave foranea reventaria en el commit con un 500."""
    u = make_user(client, "bulk12@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
        {"exercise_id": 999999, "weight_kg": 80.0, "reps": 8},
    ])
    assert res.status_code == 400
    assert res.json()["detail"] == "Ejercicio invalido"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_numera_desde_el_maximo_no_desde_la_cuenta(client, db_session, seed_exercises):
    """POST /workouts deja elegir el set_number: contar repetiria numeros."""
    u = make_user(client, "bulk13@test.com")
    res = client.post("/workouts", headers=u["headers"], json={
        "date": today_mx().isoformat(),
        "sets": [
            {"exercise_id": seed_exercises[0], "set_number": 1, "reps": 10, "weight_kg": 50.0},
            {"exercise_id": seed_exercises[0], "set_number": 3, "reps": 8, "weight_kg": 55.0},
        ],
    })
    assert res.status_code == 201, res.text

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[1], "weight_kg": 60.0, "reps": 8},
    ])
    assert res.status_code == 201, res.text

    numeros = [s.set_number for s in _series_de_hoy(db_session, u["user"]["id"])]
    assert numeros == [1, 3, 4]
    assert len(numeros) == len(set(numeros))


def test_cada_usuario_escribe_en_su_propio_entreno(client, db_session, seed_exercises):
    uno = make_user(client, "bulk14a@test.com")
    dos = make_user(client, "bulk14b@test.com")

    r1 = _bulk(client, uno["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
    ])
    r2 = _bulk(client, dos["headers"], [
        {"exercise_id": seed_exercises[1], "weight_kg": 40.0, "reps": 12},
    ])
    assert r1.json()["workout_id"] != r2.json()["workout_id"]

    series_uno = _series_de_hoy(db_session, uno["user"]["id"])
    series_dos = _series_de_hoy(db_session, dos["user"]["id"])
    assert [s.weight_kg for s in series_uno] == [80.0]
    assert [s.weight_kg for s in series_dos] == [40.0]
