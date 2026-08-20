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
        "objective": "hypertrophy", "days_per_week": dias, "days": [],
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
    hoy = today_mx()
    lunes = hoy - timedelta(days=hoy.weekday())
    # Entrenos desde el lunes de esta semana, mas uno de la semana pasada.
    for offset in (0, 1, 2):
        dia = lunes + timedelta(days=offset)
        if dia <= hoy:
            db_session.add(Workout(user_id=cli["user"]["id"], date=dia))
    db_session.add(Workout(user_id=cli["user"]["id"], date=lunes - timedelta(days=3)))
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
    a_coach, _, _, _ = _coach_con_cliente(client, db_session, "4a")
    b_coach, _, _, _ = _coach_con_cliente(client, db_session, "4b")
    correos = [f["email"] for f in client.get("/coach/clients",
                                              headers=b_coach["headers"]).json()]
    assert "cc4au@test.com" not in correos


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
