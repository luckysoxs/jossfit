import pytest
from tests.conftest import make_user
from app.models.coach import RoutineAssignment


def _crear_rutina(client, headers, name="Rutina"):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _asignar(db_session, routine_id, client_id, coach_id, status="active"):
    a = RoutineAssignment(
        routine_id=routine_id, client_id=client_id,
        coach_id=coach_id, status=status,
    )
    db_session.add(a)
    db_session.commit()
    return a.id


def test_extrano_no_lee_la_rutina(client):
    dueno = make_user(client, "d1@test.com")
    extrano = make_user(client, "e1@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.get(f"/routines/{rid}", headers=extrano["headers"])
    assert res.status_code == 404


def test_extrano_no_escribe_progreso(client):
    """El hueco que se cierra: antes esto devolvia 200."""
    dueno = make_user(client, "d2@test.com")
    extrano = make_user(client, "e2@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.put(f"/workouts/progress/{rid}", headers=extrano["headers"], json={"1": True})
    assert res.status_code == 403


def test_extrano_no_lee_progreso(client):
    dueno = make_user(client, "d3@test.com")
    extrano = make_user(client, "e3@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.get(f"/workouts/progress/{rid}", headers=extrano["headers"])
    assert res.status_code == 403


def test_asignado_si_escribe_progreso(client, db_session):
    coach = make_user(client, "co4@test.com")
    cli = make_user(client, "cl4@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    res = client.put(f"/workouts/progress/{rid}", headers=cli["headers"], json={"7": True})
    assert res.status_code == 200
    res = client.get(f"/workouts/progress/{rid}", headers=cli["headers"])
    assert res.json() == {"7": True}


def test_asignacion_revocada_pierde_acceso(client, db_session):
    coach = make_user(client, "co5@test.com")
    cli = make_user(client, "cl5@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"], status="revoked")

    assert client.get(f"/routines/{rid}", headers=cli["headers"]).status_code == 404
    assert client.put(f"/workouts/progress/{rid}", headers=cli["headers"],
                      json={"1": True}).status_code == 403


@pytest.mark.parametrize("metodo,ruta,cuerpo", [
    ("put",    "/routines/{rid}",          {"name": "Hackeada"}),
    ("delete", "/routines/{rid}",          None),
    ("put",    "/routines/{rid}/schedule", {"rest_weekdays": [6]}),
])
def test_asignado_no_puede_escribir_la_rutina(client, db_session, metodo, ruta, cuerpo):
    """La garantia central del diseno: el filtro por user_id ya deja al cliente fuera."""
    sufijo = f"{metodo}{len(ruta)}"
    coach = make_user(client, f"co6{sufijo}@test.com")
    cli = make_user(client, f"cl6{sufijo}@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    url = ruta.format(rid=rid)
    fn = getattr(client, metodo)
    res = (fn(url, headers=cli["headers"], json=cuerpo) if cuerpo is not None
           else fn(url, headers=cli["headers"]))
    assert res.status_code == 404, f"{metodo.upper()} {url} devolvio {res.status_code}"


def test_asignado_no_borra_ejercicios(client, db_session, seed_exercises):
    """Mismo principio, sobre los endpoints de /routines/exercises."""
    coach = make_user(client, "co6b@test.com")
    cli = make_user(client, "cl6b@test.com")
    res = client.post("/routines", headers=coach["headers"], json={
        "name": "Con ejercicios", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{
            "day_number": 1, "name": "Dia 1", "focus": "chest",
            "exercises": [{
                "exercise_id": seed_exercises[0], "order": 1,
                "sets": 3, "reps_min": 8, "reps_max": 12, "rest_seconds": 90,
            }],
        }],
    })
    rutina = res.json()
    rid = rutina["id"]
    ex_id = rutina["days"][0]["exercises"][0]["id"]
    day_id = rutina["days"][0]["id"]
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    assert client.delete(f"/routines/exercises/{ex_id}",
                         headers=cli["headers"]).status_code == 404
    assert client.put(f"/routines/exercises/{ex_id}", headers=cli["headers"],
                      json={"sets": 99}).status_code == 404
    assert client.put(f"/routines/exercises/{ex_id}/swap?new_exercise_id={seed_exercises[1]}",
                      headers=cli["headers"]).status_code == 404
    assert client.post(f"/routines/days/{day_id}/regenerate",
                       headers=cli["headers"]).status_code == 404
    assert client.post(f"/routines/days/{day_id}/exercises", headers=cli["headers"], json={
        "exercise_id": seed_exercises[2], "order": 2,
        "sets": 3, "reps_min": 8, "reps_max": 12, "rest_seconds": 60,
    }).status_code == 404


def test_asignado_si_lee_la_rutina(client, db_session):
    coach = make_user(client, "co7@test.com")
    cli = make_user(client, "cl7@test.com")
    rid = _crear_rutina(client, coach["headers"], name="De mi coach")
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    res = client.get(f"/routines/{rid}", headers=cli["headers"])
    assert res.status_code == 200
    assert res.json()["name"] == "De mi coach"
