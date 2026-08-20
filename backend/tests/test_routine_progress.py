from tests.conftest import make_user


def _make_routine(client, headers, name="Rutina"):
    res = client.post("/routines", headers=headers, json={
        "name": name,
        "split_type": "full_body",
        "objective": "hypertrophy",
        "days_per_week": 3,
        "days": [],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_progreso_vacio_al_inicio(client):
    u = make_user(client, "p1@test.com")
    rid = _make_routine(client, u["headers"])
    res = client.get(f"/workouts/progress/{rid}", headers=u["headers"])
    assert res.status_code == 200
    assert res.json() == {}


def test_progreso_guarda_y_lee(client):
    u = make_user(client, "p2@test.com")
    rid = _make_routine(client, u["headers"])
    payload = {"12": True, "13": False}
    res = client.put(f"/workouts/progress/{rid}", headers=u["headers"], json=payload)
    assert res.status_code == 200
    res = client.get(f"/workouts/progress/{rid}", headers=u["headers"])
    assert res.json() == payload


def test_progreso_sobrescribe_el_mismo_dia(client):
    u = make_user(client, "p3@test.com")
    rid = _make_routine(client, u["headers"])
    client.put(f"/workouts/progress/{rid}", headers=u["headers"], json={"1": True})
    client.put(f"/workouts/progress/{rid}", headers=u["headers"], json={"1": True, "2": True})
    res = client.get(f"/workouts/progress/{rid}", headers=u["headers"])
    assert res.json() == {"1": True, "2": True}


def test_progreso_separado_entre_usuarios(client, db_session):
    """Dos clientes asignados a la misma plantilla no se pisan el progreso.

    Ambos necesitan asignacion: escribir progreso contra una rutina ajena sin
    ella devuelve 403 (ver test_extrano_no_escribe_progreso).
    """
    from app.models.coach import RoutineAssignment

    coach = make_user(client, "pcoach@test.com")
    a = make_user(client, "pa@test.com")
    b = make_user(client, "pb@test.com")
    rid = _make_routine(client, coach["headers"], name="Plantilla")
    for cliente in (a, b):
        db_session.add(RoutineAssignment(
            routine_id=rid, client_id=cliente["user"]["id"], coach_id=coach["user"]["id"],
        ))
    db_session.commit()

    client.put(f"/workouts/progress/{rid}", headers=a["headers"], json={"1": True})
    client.put(f"/workouts/progress/{rid}", headers=b["headers"], json={"9": True})
    assert client.get(f"/workouts/progress/{rid}", headers=a["headers"]).json() == {"1": True}
    assert client.get(f"/workouts/progress/{rid}", headers=b["headers"]).json() == {"9": True}
