from tests.conftest import make_user
from app.models.user import User


def _bloquear(db_session, user_id, valor=True):
    db_session.query(User).filter(User.id == user_id).update({"coach_blocked": valor})
    db_session.commit()


def _hacer_admin(db_session, user_id):
    db_session.query(User).filter(User.id == user_id).update({"is_admin": True})
    db_session.commit()


def _crear_rutina_propia(client, headers, name="Mia"):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": "Pecho", "focus": "chest", "exercises": []}],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


MENSAJE = "Un administrador desactivo tu modo coach"


def test_usuario_recien_registrado_entra_al_panel(client):
    """Sin ninguna bandera: el modo coach es de todos."""
    u = make_user(client, "coach1@test.com")

    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200, res.text
    assert res.json() == []


def test_usuario_normal_crea_rutina_de_cliente_y_enlace(client):
    u = make_user(client, "coach2@test.com")

    res = client.post("/coach/routines", headers=u["headers"], json={
        "name": "Para mi primo", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    assert res.json()["is_template"] is True

    res = client.post(f"/coach/routines/{rid}/links", headers=u["headers"],
                      json={"kind": "personal"})
    assert res.status_code == 201, res.text
    assert res.json()["token"]


def test_usuario_normal_duplica_hacia_clientes(client, db_session):
    u = make_user(client, "coach3@test.com")
    rid = _crear_rutina_propia(client, u["headers"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is True


def test_bloqueado_no_entra_al_panel(client, db_session):
    u = make_user(client, "coach4@test.com")
    _bloquear(db_session, u["user"]["id"])

    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 403
    assert res.json()["detail"] == MENSAJE

    res = client.post("/coach/routines", headers=u["headers"], json={
        "name": "Nada", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 403


def test_bloqueado_no_duplica_hacia_clientes(client, db_session):
    u = make_user(client, "coach5@test.com")
    rid = _crear_rutina_propia(client, u["headers"])
    _bloquear(db_session, u["user"]["id"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 403
    assert res.json()["detail"] == MENSAJE


def test_bloqueado_si_duplica_para_si_mismo(client, db_session):
    """El bloqueo es solo para rutinas de clientes."""
    u = make_user(client, "coach6@test.com")
    rid = _crear_rutina_propia(client, u["headers"])
    _bloquear(db_session, u["user"]["id"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "mia"})
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is False


def test_admin_bloqueado_sigue_entrando(client, db_session):
    """Un admin no puede dejarse fuera del panel por error."""
    u = make_user(client, "coach7@test.com")
    _hacer_admin(db_session, u["user"]["id"])
    _bloquear(db_session, u["user"]["id"])

    assert client.get("/coach/routines", headers=u["headers"]).status_code == 200

    rid = _crear_rutina_propia(client, u["headers"])
    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 201, res.text


def test_me_expone_coach_blocked(client, db_session):
    u = make_user(client, "coach8@test.com")

    res = client.get("/auth/me", headers=u["headers"])
    assert res.status_code == 200
    assert res.json()["coach_blocked"] is False

    _bloquear(db_session, u["user"]["id"])
    res = client.get("/auth/me", headers=u["headers"])
    assert res.json()["coach_blocked"] is True


def test_admin_bloquea_y_desbloquea(client, db_session):
    admin = make_user(client, "coach9a@test.com")
    _hacer_admin(db_session, admin["user"]["id"])
    otro = make_user(client, "coach9b@test.com")
    uid = otro["user"]["id"]

    res = client.put(f"/admin/users/{uid}", headers=admin["headers"],
                     json={"coach_blocked": True})
    assert res.status_code == 200, res.text
    assert res.json()["coach_blocked"] is True
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 403

    res = client.put(f"/admin/users/{uid}", headers=admin["headers"],
                     json={"coach_blocked": False})
    assert res.status_code == 200, res.text
    assert res.json()["coach_blocked"] is False
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 200


def test_un_usuario_normal_no_bloquea_a_nadie(client):
    uno = make_user(client, "coach10a@test.com")
    dos = make_user(client, "coach10b@test.com")

    res = client.put(f"/admin/users/{dos['user']['id']}", headers=uno["headers"],
                     json={"coach_blocked": True})
    assert res.status_code == 403
    assert client.get("/coach/routines", headers=dos["headers"]).status_code == 200


def test_la_lista_de_admin_trae_coach_blocked(client, db_session):
    admin = make_user(client, "coach11a@test.com")
    _hacer_admin(db_session, admin["user"]["id"])
    otro = make_user(client, "coach11b@test.com")
    _bloquear(db_session, otro["user"]["id"])

    res = client.get("/admin/users", headers=admin["headers"])
    assert res.status_code == 200, res.text
    por_correo = {u["email"]: u for u in res.json()["users"]}
    assert por_correo["coach11b@test.com"]["coach_blocked"] is True
    assert por_correo["coach11a@test.com"]["coach_blocked"] is False
