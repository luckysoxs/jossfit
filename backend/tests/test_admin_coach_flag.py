from tests.conftest import make_user
from app.models.user import User


def test_admin_nombra_coach(client, db_session):
    admin = make_user(client, "ad1@test.com")
    db_session.query(User).filter(User.id == admin["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    otro = make_user(client, "ad1u@test.com")

    res = client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
                     json={"is_coach": True})
    assert res.status_code == 200
    assert res.json()["is_coach"] is True

    # Y ya puede entrar al panel
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 200


def test_admin_quita_el_rol(client, db_session):
    admin = make_user(client, "ad2@test.com")
    db_session.query(User).filter(User.id == admin["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    otro = make_user(client, "ad2u@test.com")

    client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
               json={"is_coach": True})
    res = client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
                     json={"is_coach": False})
    assert res.json()["is_coach"] is False
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 403


def test_un_no_admin_no_nombra_coaches(client):
    a = make_user(client, "ad3a@test.com")
    b = make_user(client, "ad3b@test.com")
    res = client.put(f"/admin/users/{b['user']['id']}", headers=a["headers"],
                     json={"is_coach": True})
    assert res.status_code == 403
