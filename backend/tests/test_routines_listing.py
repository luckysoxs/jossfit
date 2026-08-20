from tests.conftest import make_user
from app.models.coach import RoutineAssignment
from app.models.routine import Routine


def _crear_rutina(client, headers, name="Rutina", template=False, db_session=None):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    if template and db_session is not None:
        db_session.query(Routine).filter(Routine.id == rid).update({"is_template": True})
        db_session.commit()
    return rid


def test_lista_propia_incluye_las_mias(client):
    u = make_user(client, "l1@test.com")
    _crear_rutina(client, u["headers"], name="Mia")
    res = client.get("/routines", headers=u["headers"])
    assert res.status_code == 200
    assert "Mia" in [r["name"] for r in res.json()]


def test_lista_del_coach_excluye_plantillas(client, db_session):
    coach = make_user(client, "l2@test.com")
    _crear_rutina(client, coach["headers"], name="Mia propia")
    _crear_rutina(client, coach["headers"], name="Para clientes",
                  template=True, db_session=db_session)
    res = client.get("/routines", headers=coach["headers"])
    nombres = [r["name"] for r in res.json()]
    assert "Mia propia" in nombres
    assert "Para clientes" not in nombres


def test_lista_del_cliente_incluye_la_asignada(client, db_session):
    coach = make_user(client, "l3c@test.com", name="Josue")
    cli = make_user(client, "l3u@test.com")
    rid = _crear_rutina(client, coach["headers"], name="Full Body",
                        template=True, db_session=db_session)
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()

    res = client.get("/routines", headers=cli["headers"])
    asignadas = [r for r in res.json() if r["name"] == "Full Body"]
    assert len(asignadas) == 1
    assert asignadas[0]["read_only"] is True
    assert asignadas[0]["assigned_by"] == "Josue"


def test_rutina_propia_no_es_read_only(client):
    u = make_user(client, "l4@test.com")
    rid = _crear_rutina(client, u["headers"])
    res = client.get(f"/routines/{rid}", headers=u["headers"])
    assert res.json()["read_only"] is False
    assert res.json()["assigned_by"] is None


def test_detalle_de_asignada_marca_read_only(client, db_session):
    coach = make_user(client, "l5c@test.com", name="Josue")
    cli = make_user(client, "l5u@test.com")
    rid = _crear_rutina(client, coach["headers"], name="De coach",
                        template=True, db_session=db_session)
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()

    res = client.get(f"/routines/{rid}", headers=cli["headers"])
    assert res.status_code == 200
    assert res.json()["read_only"] is True
    assert res.json()["assigned_by"] == "Josue"


def test_asignacion_revocada_no_sale_en_la_lista(client, db_session):
    coach = make_user(client, "l6c@test.com")
    cli = make_user(client, "l6u@test.com")
    rid = _crear_rutina(client, coach["headers"], name="Revocada",
                        template=True, db_session=db_session)
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"],
        coach_id=coach["user"]["id"], status="revoked",
    ))
    db_session.commit()

    res = client.get("/routines", headers=cli["headers"])
    assert "Revocada" not in [r["name"] for r in res.json()]
