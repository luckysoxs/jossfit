from tests.conftest import make_user
from app.models.coach import RoutineAssignment
from app.models.user import User


def _coach(client, db_session, email):
    u = make_user(client, email)
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    return u


def _rutina(client, headers, ejercicios, ruta="/routines", name="Base"):
    res = client.post(ruta, headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": "Dia 1", "focus": "full", "exercises": [
            {"exercise_id": ejercicios[0], "order": 1, "sets": 3,
             "reps_min": 8, "reps_max": 12, "rest_seconds": 90},
        ]}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def _duplicar(client, headers, rid, **body):
    return client.post(f"/routines/{rid}/duplicate", headers=headers, json=body)


def test_personal_a_cliente(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup1@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)

    res = _duplicar(client, coach["headers"], orig["id"], destino="cliente")
    assert res.status_code == 201, res.text
    copia = res.json()
    assert copia["id"] != orig["id"]
    assert copia["is_template"] is True
    assert copia["name"] == "Base (copia)"
    assert len(copia["days"][0]["exercises"]) == 1

    ids = [r["id"] for r in client.get("/coach/routines", headers=coach["headers"]).json()]
    assert copia["id"] in ids


def test_cliente_a_cliente_sin_links_ni_clientes(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup2@test.com")
    cli = make_user(client, "dup2c@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")
    assert client.post(f"/coach/routines/{orig['id']}/links", headers=coach["headers"],
                       json={"kind": "personal"}).status_code == 201
    db_session.add(RoutineAssignment(routine_id=orig["id"], client_id=cli["user"]["id"],
                                     coach_id=coach["user"]["id"]))
    db_session.commit()

    res = _duplicar(client, coach["headers"], orig["id"], destino="cliente", name="Para Ana")
    assert res.status_code == 201, res.text
    copia = res.json()
    assert copia["name"] == "Para Ana"

    filas = {r["id"]: r for r in client.get("/coach/routines", headers=coach["headers"]).json()}
    assert filas[orig["id"]]["clients_count"] == 1
    assert filas[copia["id"]]["clients_count"] == 0
    links = client.get(f"/coach/routines/{copia['id']}/links", headers=coach["headers"]).json()
    assert links == []


def test_cliente_a_mia(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup3@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")

    res = _duplicar(client, coach["headers"], orig["id"], destino="mia")
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is False
    ids = [r["id"] for r in client.get("/routines", headers=coach["headers"]).json()]
    assert res.json()["id"] in ids


def test_copia_independiente(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup4@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)
    copia = _duplicar(client, coach["headers"], orig["id"], destino="mia").json()

    ex_copia = copia["days"][0]["exercises"][0]["id"]
    assert client.put(f"/routines/exercises/{ex_copia}", headers=coach["headers"],
                      json={"sets": 9}).status_code == 200

    otra = client.get(f"/routines/{orig['id']}", headers=coach["headers"]).json()
    assert otra["days"][0]["exercises"][0]["sets"] == 3


def test_ajeno_recibe_404(client, db_session, seed_exercises):
    dueno = _coach(client, db_session, "dup5@test.com")
    otro = _coach(client, db_session, "dup5o@test.com")
    orig = _rutina(client, dueno["headers"], seed_exercises)
    assert _duplicar(client, otro["headers"], orig["id"], destino="mia").status_code == 404


def test_cliente_asignado_recibe_404(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup6@test.com")
    cli = make_user(client, "dup6c@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")
    db_session.add(RoutineAssignment(routine_id=orig["id"], client_id=cli["user"]["id"],
                                     coach_id=coach["user"]["id"]))
    db_session.commit()
    assert _duplicar(client, cli["headers"], orig["id"], destino="mia").status_code == 404


def test_no_coach_no_crea_rutina_de_cliente(client, seed_exercises):
    u = make_user(client, "dup7@test.com")
    orig = _rutina(client, u["headers"], seed_exercises)
    assert _duplicar(client, u["headers"], orig["id"], destino="cliente").status_code == 403
    assert _duplicar(client, u["headers"], orig["id"], destino="mia").status_code == 201


def test_admin_crea_rutina_de_cliente(client, db_session, seed_exercises):
    u = make_user(client, "dup8@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    orig = _rutina(client, u["headers"], seed_exercises)
    res = _duplicar(client, u["headers"], orig["id"], destino="cliente")
    assert res.status_code == 201
    assert res.json()["is_template"] is True


def test_destino_invalido(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup9@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)
    assert _duplicar(client, coach["headers"], orig["id"], destino="otro").status_code == 422
