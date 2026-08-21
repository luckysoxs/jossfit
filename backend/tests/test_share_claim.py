from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.coach import RoutineAssignment, RoutineShareLink, ShareLinkVisit
from app.utils.timezone import now_mx


def _coach_con_enlace(client, db_session, email, kind="plantilla",
                      max_claims=None, expires_in_days=None, name="Josue"):
    coach = make_user(client, email, name=name)
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 4,
        "days": [
            {"day_number": 1, "name": "Pecho/Triceps", "focus": "chest", "exercises": []},
            {"day_number": 2, "name": "Espalda/Biceps", "focus": "back", "exercises": []},
        ],
    })
    rid = res.json()["id"]
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": kind, "label": None,
        "max_claims": max_claims, "expires_in_days": expires_in_days,
    })
    return coach, rid, res.json()["token"]


def test_vista_previa_sin_sesion(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s1@test.com")
    res = client.get(f"/share/{token}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "valido"
    assert body["routine_name"] == "Full Body"
    assert body["coach_name"] == "Josue"
    assert body["days_per_week"] == 4
    assert body["day_names"] == ["Pecho/Triceps", "Espalda/Biceps"]
    assert body["already_claimed"] is False


def test_vista_previa_no_filtra_ejercicios(client, db_session):
    """Si mandara la rutina completa, el enlace dejaria de ser razon para registrarse."""
    _, _, token = _coach_con_enlace(client, db_session, "s2@test.com")
    body = client.get(f"/share/{token}").json()
    assert "days" not in body
    assert "exercises" not in body
    for clave in body:
        assert "exercise" not in clave or clave == "total_exercises"


def test_token_inexistente(client):
    res = client.get("/share/estonoexiste")
    assert res.status_code == 200
    assert res.json()["status"] == "no_existe"


def test_enlace_revocado(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s3@test.com")
    db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == token
    ).update({"revoked": True})
    db_session.commit()
    assert client.get(f"/share/{token}").json()["status"] == "revocado"


def test_enlace_expirado(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s4@test.com")
    ayer = now_mx().replace(tzinfo=None) - timedelta(days=1)
    db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == token
    ).update({"expires_at": ayer})
    db_session.commit()
    assert client.get(f"/share/{token}").json()["status"] == "expirado"


def test_enlace_lleno(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s5@test.com", max_claims=1)
    primero = make_user(client, "s5a@test.com")
    assert client.post(f"/share/{token}/claim", headers=primero["headers"]).status_code == 200

    segundo = make_user(client, "s5b@test.com")
    assert client.get(f"/share/{token}").json()["status"] == "lleno"
    res = client.post(f"/share/{token}/claim", headers=segundo["headers"])
    assert res.status_code == 400
    assert "cupo" in res.json()["detail"].lower()


def test_reclamar_crea_asignacion(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s6@test.com")
    cli = make_user(client, "s6a@test.com")
    res = client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert res.status_code == 200
    assert res.json()["routine_id"] == rid
    assert res.json()["routine_name"] == "Full Body"

    a = db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).first()
    assert a is not None
    assert a.status == "active"
    assert a.coach_id == coach["user"]["id"]


def test_reclamar_dos_veces_es_idempotente(client, db_session):
    """Refrescar la pagina no debe quemar un cupo de una plantilla limitada."""
    coach, rid, token = _coach_con_enlace(client, db_session, "s7@test.com", max_claims=5)
    cli = make_user(client, "s7a@test.com")

    r1 = client.post(f"/share/{token}/claim", headers=cli["headers"])
    r2 = client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["routine_id"] == r2.json()["routine_id"]

    total = db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).count()
    assert total == 1

    enlaces = client.get(f"/coach/routines/{rid}/links", headers=coach["headers"]).json()
    assert enlaces[0]["claims"] == 1
    assert enlaces[0]["remaining"] == 4


def test_reclamar_sin_sesion_pide_login(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s8@test.com")
    assert client.post(f"/share/{token}/claim").status_code == 401


def test_already_claimed_con_sesion(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s9@test.com")
    cli = make_user(client, "s9a@test.com")
    assert client.get(f"/share/{token}", headers=cli["headers"]).json()["already_claimed"] is False
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert client.get(f"/share/{token}", headers=cli["headers"]).json()["already_claimed"] is True


def test_token_invalido_no_rompe_la_vista_previa(client, db_session):
    """Un token vencido en el navegador no debe tumbar la pantalla publica."""
    _, _, token = _coach_con_enlace(client, db_session, "s10@test.com")
    res = client.get(f"/share/{token}", headers={"Authorization": "Bearer basura"})
    assert res.status_code == 200
    assert res.json()["status"] == "valido"
    assert res.json()["already_claimed"] is False


def test_el_coach_no_reclama_su_propio_enlace(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s11@test.com")
    assert client.get(f"/share/{token}", headers=coach["headers"]).json()["is_own"] is True
    res = client.post(f"/share/{token}/claim", headers=coach["headers"])
    assert res.status_code == 400
    assert "tuya" in res.json()["detail"].lower()


def test_la_visita_queda_registrada(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s12@test.com")
    client.get(f"/share/{token}")
    cli = make_user(client, "s12a@test.com")
    client.get(f"/share/{token}", headers=cli["headers"])

    link = db_session.query(RoutineShareLink).filter(RoutineShareLink.token == token).first()
    visitas = db_session.query(ShareLinkVisit).filter(ShareLinkVisit.link_id == link.id).all()
    assert len(visitas) == 2
    assert visitas[0].user_id is None
    assert visitas[1].user_id == cli["user"]["id"]


def test_revocar_acceso_libera_el_cupo(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s13@test.com", max_claims=1)
    cli = make_user(client, "s13a@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert client.get(f"/share/{token}").json()["status"] == "lleno"

    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).update({"status": "revoked"})
    db_session.commit()

    assert client.get(f"/share/{token}").json()["status"] == "valido"
