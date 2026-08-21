from tests.conftest import make_user
from app.models.user import User
from app.models.notification import Notification
from app.models.coach import RoutineAssignment


def _coach_con_enlace(client, db_session, sufijo):
    coach = make_user(client, f"nt{sufijo}c@test.com", name="Josue")
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    rid = res.json()["id"]
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    return coach, rid, res.json()["token"]


def _notifs(db_session, user_id):
    return db_session.query(Notification).filter(Notification.user_id == user_id).all()


def test_avisa_al_coach_cuando_reclaman(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "1")
    cli = make_user(client, "nt1u@test.com", name="Juan Perez")
    client.post(f"/share/{token}/claim", headers=cli["headers"])

    avisos = _notifs(db_session, coach["user"]["id"])
    assert len(avisos) == 1
    assert "Juan Perez" in avisos[0].body
    assert "Full Body" in avisos[0].body
    assert avisos[0].url == "/coach"


def test_reclamo_idempotente_no_avisa_dos_veces(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "2")
    cli = make_user(client, "nt2u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert len(_notifs(db_session, coach["user"]["id"])) == 1


def test_avisa_al_coach_de_una_solicitud(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "3")
    cli = make_user(client, "nt3u@test.com", name="Juan")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Me duele la rodilla",
    })
    avisos = _notifs(db_session, coach["user"]["id"])
    assert len(avisos) == 1
    assert "Juan" in avisos[0].body


def test_avisa_al_cliente_de_la_respuesta(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "4")
    cli = make_user(client, "nt4u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio",
    })
    req_id = res.json()["id"]
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/coach/change-requests/{req_id}", headers=coach["headers"], json={
        "status": "aceptada", "coach_reply": "Listo, ya te lo cambie",
    })
    avisos = _notifs(db_session, cli["user"]["id"])
    assert len(avisos) == 1
    assert "Listo" in avisos[0].body


def test_avisa_al_cliente_cuando_el_coach_edita(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "5")
    cli = make_user(client, "nt5u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "Full Body v2"})
    avisos = _notifs(db_session, cli["user"]["id"])
    assert len(avisos) == 1
    assert "actualiz" in avisos[0].body.lower()
    assert avisos[0].url == f"/routines/{rid}"


def test_editar_una_rutina_sin_asignados_no_avisa_a_nadie(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "6")
    db_session.query(Notification).delete()
    db_session.commit()
    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "Otro nombre"})
    assert db_session.query(Notification).count() == 0


def test_avisa_a_todos_los_asignados(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "7")
    a = make_user(client, "nt7a@test.com")
    b = make_user(client, "nt7b@test.com")
    client.post(f"/share/{token}/claim", headers=a["headers"])
    client.post(f"/share/{token}/claim", headers=b["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "v2"})
    assert len(_notifs(db_session, a["user"]["id"])) == 1
    assert len(_notifs(db_session, b["user"]["id"])) == 1


def test_asignado_revocado_no_recibe_aviso_de_edicion(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "8")
    cli = make_user(client, "nt8u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.client_id == cli["user"]["id"]
    ).update({"status": "revoked"})
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "v2"})
    assert _notifs(db_session, cli["user"]["id"]) == []
