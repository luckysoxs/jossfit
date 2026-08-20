from tests.conftest import make_user
from app.models.user import User
from app.models.coach import RoutineAssignment


def _coach_cliente_y_rutina(client, db_session, sufijo, seed_exercises):
    coach = make_user(client, f"cr{sufijo}c@test.com", name="Josue")
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()

    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3,
        "days": [{
            "day_number": 1, "name": "Dia 1", "focus": "quadriceps",
            "exercises": [{
                "exercise_id": seed_exercises[1], "order": 1,
                "sets": 4, "reps_min": 6, "reps_max": 10, "rest_seconds": 120,
            }],
        }],
    })
    rutina = res.json()
    rid = rutina["id"]
    ex_id = rutina["days"][0]["exercises"][0]["id"]

    cli = make_user(client, f"cr{sufijo}u@test.com", name="Juan")
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()
    return coach, cli, rid, ex_id


def test_cliente_crea_solicitud(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "1", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id,
        "content": "La sentadilla me lastima la rodilla",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pendiente"
    assert body["client_name"] == "Juan"
    assert body["routine_name"] == "Full Body"
    assert body["exercise_name"] == "Sentadilla"  # name_es del seed
    assert body["coach_reply"] is None


def test_solicitud_sin_ejercicio_es_valida(client, db_session, seed_exercises):
    coach, cli, rid, _ = _coach_cliente_y_rutina(client, db_session, "2", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None,
        "content": "Necesito bajar a 3 dias por semana",
    })
    assert res.status_code == 201
    assert res.json()["exercise_name"] is None


def test_solicitud_vacia_se_rechaza(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "3", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id, "content": "   ",
    })
    assert res.status_code == 400


def test_sin_asignacion_no_puede_pedir_cambios(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "4", seed_exercises)
    extrano = make_user(client, "cr4x@test.com")
    res = client.post(f"/routines/{rid}/change-request", headers=extrano["headers"], json={
        "routine_exercise_id": ex_id, "content": "Cambiame esto",
    })
    assert res.status_code == 403


def test_el_dueno_no_se_pide_cambios_a_si_mismo(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "5", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=coach["headers"], json={
        "routine_exercise_id": ex_id, "content": "Nota para mi",
    })
    assert res.status_code == 403


def test_coach_ve_la_solicitud(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "6", seed_exercises)
    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id, "content": "Me duele la rodilla",
    })
    res = client.get("/coach/change-requests", headers=coach["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["content"] == "Me duele la rodilla"


def test_coach_no_ve_solicitudes_de_otro_coach(client, db_session, seed_exercises):
    a_coach, a_cli, a_rid, a_ex = _coach_cliente_y_rutina(client, db_session, "7a", seed_exercises)
    b_coach, b_cli, b_rid, b_ex = _coach_cliente_y_rutina(client, db_session, "7b", seed_exercises)
    client.post(f"/routines/{a_rid}/change-request", headers=a_cli["headers"], json={
        "routine_exercise_id": a_ex, "content": "Solicitud de A",
    })
    contenidos = [r["content"] for r in
                  client.get("/coach/change-requests", headers=b_coach["headers"]).json()]
    assert "Solicitud de A" not in contenidos


def test_filtrar_por_status(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "8", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id, "content": "Uno",
    })
    req_id = res.json()["id"]
    client.put(f"/coach/change-requests/{req_id}", headers=coach["headers"], json={
        "status": "aceptada", "coach_reply": "Listo, te lo cambie",
    })
    pendientes = client.get("/coach/change-requests?status=pendiente",
                            headers=coach["headers"]).json()
    assert pendientes == []
    aceptadas = client.get("/coach/change-requests?status=aceptada",
                           headers=coach["headers"]).json()
    assert len(aceptadas) == 1


def test_responder_solicitud(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "9", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id, "content": "Cambiala",
    })
    req_id = res.json()["id"]

    res = client.put(f"/coach/change-requests/{req_id}", headers=coach["headers"], json={
        "status": "rechazada", "coach_reply": "Aguanta dos semanas mas",
    })
    assert res.status_code == 200
    assert res.json()["status"] == "rechazada"
    assert res.json()["coach_reply"] == "Aguanta dos semanas mas"


def test_status_invalido_se_rechaza(client, db_session, seed_exercises):
    coach, cli, rid, ex_id = _coach_cliente_y_rutina(client, db_session, "10", seed_exercises)
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": ex_id, "content": "X",
    })
    req_id = res.json()["id"]
    res = client.put(f"/coach/change-requests/{req_id}", headers=coach["headers"], json={
        "status": "inventado", "coach_reply": None,
    })
    assert res.status_code == 400


def test_coach_no_responde_solicitud_ajena(client, db_session, seed_exercises):
    a_coach, a_cli, a_rid, a_ex = _coach_cliente_y_rutina(client, db_session, "11a", seed_exercises)
    b_coach, _, _, _ = _coach_cliente_y_rutina(client, db_session, "11b", seed_exercises)
    res = client.post(f"/routines/{a_rid}/change-request", headers=a_cli["headers"], json={
        "routine_exercise_id": a_ex, "content": "De A",
    })
    req_id = res.json()["id"]
    res = client.put(f"/coach/change-requests/{req_id}", headers=b_coach["headers"], json={
        "status": "aceptada", "coach_reply": "Mia",
    })
    assert res.status_code == 404
