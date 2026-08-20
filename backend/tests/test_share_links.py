from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.routine import Routine
from app.models.coach import RoutineShareLink
from app.utils.timezone import now_mx


def hacer_coach(db_session, user_id):
    db_session.query(User).filter(User.id == user_id).update({"is_coach": True})
    db_session.commit()


def crear_rutina_de_cliente(client, headers, name="Full Body"):
    res = client.post("/coach/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_rutina_de_coach_nace_como_plantilla(client, db_session):
    coach = make_user(client, "t1@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])
    r = db_session.query(Routine).filter(Routine.id == rid).first()
    assert r.is_template is True


def test_crear_enlace_personal_fuerza_un_cupo(client, db_session):
    coach = make_user(client, "t2@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "personal", "label": "Rutina de Juan",
        "max_claims": 50, "expires_in_days": None,
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "personal"
    assert body["max_claims"] == 1  # personal siempre es 1, sin importar lo que manden
    assert body["label"] == "Rutina de Juan"
    assert len(body["token"]) >= 20
    assert body["path"] == f"/r/{body['token']}"
    assert body["revoked"] is False
    assert body["visits"] == 0
    assert body["claims"] == 0
    assert body["remaining"] == 1


def test_crear_enlace_plantilla_sin_limite(client, db_session):
    coach = make_user(client, "t3@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None,
        "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 201
    assert res.json()["max_claims"] is None
    assert res.json()["remaining"] is None


def test_expires_in_days_se_convierte_en_fecha(client, db_session):
    coach = make_user(client, "t4@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": 20, "expires_in_days": 30,
    })
    assert res.status_code == 201
    link = db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == res.json()["token"]
    ).first()
    delta = link.expires_at - now_mx().replace(tzinfo=None)
    assert timedelta(days=29) < delta < timedelta(days=31)


def test_no_se_puede_compartir_una_rutina_personal(client, db_session):
    """Solo se comparten rutinas marcadas para clientes."""
    coach = make_user(client, "t5@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    res = client.post("/routines", headers=coach["headers"], json={
        "name": "La mia", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    rid = res.json()["id"]

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 400
    assert "cliente" in res.json()["detail"].lower()


def test_coach_no_comparte_rutina_de_otro_coach(client, db_session):
    a = make_user(client, "t6a@test.com")
    b = make_user(client, "t6b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    rid = crear_rutina_de_cliente(client, a["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=b["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 404


def test_listar_rutinas_solo_las_propias(client, db_session):
    a = make_user(client, "t7a@test.com")
    b = make_user(client, "t7b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    crear_rutina_de_cliente(client, a["headers"], name="De A")
    crear_rutina_de_cliente(client, b["headers"], name="De B")

    nombres_a = [r["name"] for r in client.get("/coach/routines", headers=a["headers"]).json()]
    assert nombres_a == ["De A"]
    nombres_b = [r["name"] for r in client.get("/coach/routines", headers=b["headers"]).json()]
    assert nombres_b == ["De B"]


def test_revocar_enlace(client, db_session):
    coach = make_user(client, "t8@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    link_id = res.json()["id"]

    assert client.delete(f"/coach/links/{link_id}", headers=coach["headers"]).status_code == 200
    enlaces = client.get(f"/coach/routines/{rid}/links", headers=coach["headers"]).json()
    assert enlaces[0]["revoked"] is True


def test_no_se_revoca_el_enlace_de_otro_coach(client, db_session):
    a = make_user(client, "t9a@test.com")
    b = make_user(client, "t9b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    rid = crear_rutina_de_cliente(client, a["headers"])
    res = client.post(f"/coach/routines/{rid}/links", headers=a["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    link_id = res.json()["id"]

    assert client.delete(f"/coach/links/{link_id}", headers=b["headers"]).status_code == 404
