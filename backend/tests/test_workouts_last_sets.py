from datetime import timedelta

from tests.conftest import make_user
from app.models.workout import Workout, WorkoutSet
from app.utils.timezone import today_mx


def _serie(db_session, user_id, exercise_id, weight, reps, dia, completed=True):
    """Crea un entrenamiento con una serie. Devuelve el id de la serie."""
    w = Workout(user_id=user_id, date=dia)
    db_session.add(w)
    db_session.flush()
    s = WorkoutSet(
        workout_id=w.id, exercise_id=exercise_id, set_number=1,
        reps=reps, weight_kg=weight, completed=completed,
    )
    db_session.add(s)
    db_session.commit()
    return s.id


def _por_ejercicio(res):
    return {item["exercise_id"]: item for item in res.json()}


def test_devuelve_la_ultima_serie_no_la_mas_pesada(client, db_session, seed_exercises):
    u = make_user(client, "last1@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 100.0, 5, hoy - timedelta(days=2))
    _serie(db_session, u["user"]["id"], ex, 80.0, 8, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.status_code == 200, res.text
    fila = _por_ejercicio(res)[ex]
    assert fila["weight_kg"] == 80.0
    assert fila["reps"] == 8


def test_desempata_por_id_cuando_es_el_mismo_dia(client, db_session, seed_exercises):
    u = make_user(client, "last2@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 60.0, 12, hoy)
    _serie(db_session, u["user"]["id"], ex, 65.0, 10, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    fila = _por_ejercicio(res)[ex]
    assert fila["weight_kg"] == 65.0
    assert fila["reps"] == 10


def test_ignora_series_no_completadas(client, db_session, seed_exercises):
    u = make_user(client, "last3@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 70.0, 10, hoy - timedelta(days=1))
    _serie(db_session, u["user"]["id"], ex, 999.0, 1, hoy, completed=False)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert _por_ejercicio(res)[ex]["weight_kg"] == 70.0


def test_un_item_por_ejercicio(client, db_session, seed_exercises):
    u = make_user(client, "last4@test.com")
    hoy = today_mx()
    _serie(db_session, u["user"]["id"], seed_exercises[0], 50.0, 10, hoy)
    _serie(db_session, u["user"]["id"], seed_exercises[0], 55.0, 9, hoy)
    _serie(db_session, u["user"]["id"], seed_exercises[1], 90.0, 6, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    por_ex = _por_ejercicio(res)
    assert len(res.json()) == 2
    assert por_ex[seed_exercises[0]]["weight_kg"] == 55.0
    assert por_ex[seed_exercises[1]]["weight_kg"] == 90.0


def test_no_devuelve_series_de_otro_usuario(client, db_session, seed_exercises):
    u = make_user(client, "last5@test.com")
    otro = make_user(client, "last5o@test.com")
    _serie(db_session, otro["user"]["id"], seed_exercises[0], 120.0, 3, today_mx())

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.json() == []


def test_sin_historial_devuelve_lista_vacia(client, seed_exercises):
    u = make_user(client, "last6@test.com")
    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.status_code == 200
    assert res.json() == []


def test_sin_token_da_401(client):
    assert client.get("/workouts/last-sets").status_code == 401
