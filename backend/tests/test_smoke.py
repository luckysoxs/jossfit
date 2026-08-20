from tests.conftest import make_user


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_register_and_me(client):
    u = make_user(client, "smoke@test.com", name="Smoke")
    res = client.get("/auth/me", headers=u["headers"])
    assert res.status_code == 200
    assert res.json()["email"] == "smoke@test.com"
    assert res.json()["name"] == "Smoke"


def test_exercises_fixture_loads(client, seed_exercises):
    assert len(seed_exercises) == 3
