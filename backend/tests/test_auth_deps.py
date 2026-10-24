from tests.conftest import make_user
from app.models.user import User


def test_bloqueado_recibe_403(client, db_session):
    u = make_user(client, "nocoach@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"coach_blocked": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 403
    assert "coach" in res.json()["detail"].lower()


def test_coach_entra(client, db_session):
    u = make_user(client, "coach@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200


def test_admin_tambien_entra(client, db_session):
    """Un admin es coach implicito: no hay que darle los dos flags."""
    u = make_user(client, "admin@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200


def test_sin_token_recibe_401(client):
    res = client.get("/coach/routines")
    assert res.status_code == 401
