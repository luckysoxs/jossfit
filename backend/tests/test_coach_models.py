import pytest
from sqlalchemy.exc import IntegrityError

from tests.conftest import make_user


def test_usuario_nuevo_no_es_coach(client):
    u = make_user(client, "nc@test.com")
    assert u["user"]["is_coach"] is False


def test_rutina_nueva_no_es_plantilla(client):
    u = make_user(client, "nt@test.com")
    res = client.post("/routines", headers=u["headers"], json={
        "name": "Mia", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201
    body = res.json()
    assert body["is_template"] is False
    assert body["read_only"] is False
    assert body["assigned_by"] is None


def test_tablas_de_coach_existen(db_session):
    from app.models.coach import (
        RoutineShareLink, RoutineAssignment, ShareLinkVisit, RoutineChangeRequest,
    )
    assert db_session.query(RoutineShareLink).count() == 0
    assert db_session.query(RoutineAssignment).count() == 0
    assert db_session.query(ShareLinkVisit).count() == 0
    assert db_session.query(RoutineChangeRequest).count() == 0


def test_asignacion_unica_por_rutina_y_cliente(client, db_session):
    """El UNIQUE es lo que hace idempotente el reclamo."""
    from app.models.coach import RoutineAssignment

    coach = make_user(client, "c@test.com")
    cli = make_user(client, "cl@test.com")
    res = client.post("/routines", headers=coach["headers"], json={
        "name": "Plantilla", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    rid = res.json()["id"]

    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()

    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
