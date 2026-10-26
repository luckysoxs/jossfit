from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.coach import RoutineAssignment
from app.models.workout import Workout
from app.utils.timezone import today_mx


def _coach_con_cliente(client, db_session, sufijo, dias=4):
    coach = make_user(client, f"cc{sufijo}c@test.com", name="Josue")
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": dias,
        "days": [{"day_number": 1, "name": "Dia 1", "focus": "chest", "exercises": []}],
    })
    rid = res.json()["id"]
    cli = make_user(client, f"cc{sufijo}u@test.com", name="Juan Perez")
    a = RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    )
    db_session.add(a)
    db_session.commit()
    return coach, cli, rid, a.id


def test_cliente_sin_entrenos(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "1")
    res = client.get("/coach/clients", headers=coach["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    fila = res.json()[0]
    assert fila["name"] == "Juan Perez"
    assert fila["routine_name"] == "Full Body"
    assert fila["days_per_week"] == 4
    assert fila["last_workout_date"] is None
    assert fila["workouts_this_week"] == 0
    assert fila["pending_requests"] == 0
    assert fila["assignment_id"] == aid


def test_cuenta_entrenos_de_la_semana(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "2")
    # Los entrenos cuentan por estar ligados al dia de ESTA rutina.
    day_id = client.get(f"/routines/{rid}", headers=coach["headers"]).json()["days"][0]["id"]
    hoy = today_mx()
    lunes = hoy - timedelta(days=hoy.weekday())
    # Entrenos desde el lunes de esta semana, mas uno de la semana pasada.
    for offset in (0, 1, 2):
        dia = lunes + timedelta(days=offset)
        if dia <= hoy:
            db_session.add(Workout(user_id=cli["user"]["id"], date=dia, routine_day_id=day_id))
    db_session.add(Workout(user_id=cli["user"]["id"], date=lunes - timedelta(days=3),
                           routine_day_id=day_id))
    db_session.commit()

    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    esperados = len([o for o in (0, 1, 2) if lunes + timedelta(days=o) <= hoy])
    assert fila["workouts_this_week"] == esperados
    assert fila["last_workout_date"] is not None


def test_cuenta_solicitudes_pendientes(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "3")
    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio uno",
    })
    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio dos",
    })
    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    assert fila["pending_requests"] == 2


def test_coach_no_ve_clientes_de_otro_coach(client, db_session):
    a_coach, a_cli, _, _ = _coach_con_cliente(client, db_session, "4a")
    b_coach, _, _, _ = _coach_con_cliente(client, db_session, "4b")
    ids = [f["user_id"] for f in client.get("/coach/clients",
                                            headers=b_coach["headers"]).json()]
    assert a_cli["user"]["id"] not in ids


def test_asignacion_revocada_no_sale(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "5")
    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.id == aid
    ).update({"status": "revoked"})
    db_session.commit()
    assert client.get("/coach/clients", headers=coach["headers"]).json() == []


def test_quitar_acceso(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "6")
    res = client.delete(f"/coach/assignments/{aid}", headers=coach["headers"])
    assert res.status_code == 200
    assert client.get("/coach/clients", headers=coach["headers"]).json() == []
    # El cliente pierde la rutina
    assert client.get(f"/routines/{rid}", headers=cli["headers"]).status_code == 404


def test_quitar_acceso_conserva_el_historial(client, db_session):
    """Los workouts del cliente son suyos: alimentan sus graficas y sus 1RM."""
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "7")
    db_session.add(Workout(user_id=cli["user"]["id"], date=today_mx()))
    db_session.commit()

    client.delete(f"/coach/assignments/{aid}", headers=coach["headers"])
    quedan = db_session.query(Workout).filter(Workout.user_id == cli["user"]["id"]).count()
    assert quedan == 1


def test_no_se_quita_acceso_de_otro_coach(client, db_session):
    a_coach, _, _, a_aid = _coach_con_cliente(client, db_session, "8a")
    b_coach, _, _, _ = _coach_con_cliente(client, db_session, "8b")
    res = client.delete(f"/coach/assignments/{a_aid}", headers=b_coach["headers"])
    assert res.status_code == 404


def test_detalle_de_un_cliente(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "9")
    res = client.get(f"/coach/clients/{cli['user']['id']}", headers=coach["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["routine_id"] == rid


# ─── Privacidad de la fila de cliente ───

def test_la_fila_no_trae_el_correo_del_cliente(client, db_session):
    """Reclamar una rutina no es consentir que te cosechen el correo."""
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "p1")

    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    assert "email" not in fila
    assert fila["user_id"] == cli["user"]["id"]


def test_adherencia_solo_cuenta_entrenos_de_la_rutina_asignada(client, db_session):
    """El panel es para ver si siguen TU rutina, no toda su vida deportiva."""
    coach = make_user(client, "p2c@test.com", name="Josue")
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 2,
        "days": [{"day_number": 1, "name": "Pecho", "focus": "chest", "exercises": []}],
    })
    rid = res.json()["id"]
    day_id = res.json()["days"][0]["id"]

    cli = make_user(client, "p2u@test.com", name="Juan")
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()

    hoy = today_mx()
    # Un entreno de la rutina del coach.
    w1 = Workout(user_id=cli["user"]["id"], date=hoy, routine_day_id=day_id)
    # Y uno suyo, por su cuenta, sin relacion con esta rutina.
    w2 = Workout(user_id=cli["user"]["id"], date=hoy - timedelta(days=1))
    db_session.add_all([w1, w2])
    db_session.commit()

    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    assert fila["workouts_this_week"] == 1
    assert fila["last_workout_date"] == hoy.isoformat()
