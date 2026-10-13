import pytest

from tests.conftest import make_user
from app.models.coach import RoutineAssignment


def _rutina_con_dia(client, headers, nombre_dia="Pecho"):
    """Rutina de un dia; devuelve (routine_id, day_id)."""
    res = client.post("/routines", headers=headers, json={
        "name": "Rutina", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": nombre_dia, "focus": "chest", "exercises": []}],
    })
    assert res.status_code == 201, res.text
    rutina = res.json()
    return rutina["id"], rutina["days"][0]["id"]


def _nombre_del_dia(client, headers, rid):
    return client.get(f"/routines/{rid}", headers=headers).json()["days"][0]["name"]


def test_renombra_un_dia_propio(client, db_session):
    u = make_user(client, "dia1@test.com")
    rid, did = _rutina_con_dia(client, u["headers"])

    res = client.put(f"/routines/days/{did}", headers=u["headers"], json={"name": "  Empuje  "})
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True, "name": "Empuje"}
    assert _nombre_del_dia(client, u["headers"], rid) == "Empuje"


@pytest.mark.parametrize("nombre", ["", "   "])
def test_nombre_vacio_da_400(client, db_session, nombre):
    u = make_user(client, f"dia2{len(nombre)}@test.com")
    rid, did = _rutina_con_dia(client, u["headers"])

    res = client.put(f"/routines/days/{did}", headers=u["headers"], json={"name": nombre})
    assert res.status_code == 400
    assert res.json()["detail"] == "Escribe un nombre para el dia"
    assert _nombre_del_dia(client, u["headers"], rid) == "Pecho"


@pytest.mark.parametrize("n,nombre", list(enumerate([
    "Lunes - Pecho",
    "lunes - pecho",
    "Miercoles - Pierna",
    "miércoles - pierna",
    "Sábado  -  Brazo",
])))
def test_prefijo_de_dia_de_la_semana_da_400(client, db_session, n, nombre):
    u = make_user(client, f"dia3{n}@test.com")
    rid, did = _rutina_con_dia(client, u["headers"])

    res = client.put(f"/routines/days/{did}", headers=u["headers"], json={"name": nombre})
    assert res.status_code == 400, f"{nombre} devolvio {res.status_code}"
    assert res.json()["detail"] == "El dia de la semana se pone solo; escribe solo el nombre"
    assert _nombre_del_dia(client, u["headers"], rid) == "Pecho"


@pytest.mark.parametrize("nombre", ["Lunes", "Lunes pesado", "Domingo de pierna"])
def test_dia_de_la_semana_sin_guion_si_se_acepta(client, db_session, nombre):
    """La regla es sobre el prefijo repetido, no sobre la palabra."""
    u = make_user(client, f"dia4{len(nombre)}@test.com")
    rid, did = _rutina_con_dia(client, u["headers"])

    res = client.put(f"/routines/days/{did}", headers=u["headers"], json={"name": nombre})
    assert res.status_code == 200, res.text
    assert _nombre_del_dia(client, u["headers"], rid) == nombre


def test_nombre_largo_se_recorta_a_100(client, db_session):
    u = make_user(client, "dia5@test.com")
    rid, did = _rutina_con_dia(client, u["headers"])

    res = client.put(f"/routines/days/{did}", headers=u["headers"], json={"name": "x" * 150})
    assert res.status_code == 200, res.text
    assert res.json()["name"] == "x" * 100
    assert _nombre_del_dia(client, u["headers"], rid) == "x" * 100


def test_dia_de_otro_usuario_da_404(client, db_session):
    dueno = make_user(client, "dia6@test.com")
    otro = make_user(client, "dia6o@test.com")
    rid, did = _rutina_con_dia(client, dueno["headers"])

    res = client.put(f"/routines/days/{did}", headers=otro["headers"], json={"name": "Hackeado"})
    assert res.status_code == 404
    assert _nombre_del_dia(client, dueno["headers"], rid) == "Pecho"


def test_cliente_asignado_da_404(client, db_session):
    coach = make_user(client, "dia7@test.com")
    cli = make_user(client, "dia7c@test.com")
    rid, did = _rutina_con_dia(client, coach["headers"])
    db_session.add(RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    ))
    db_session.commit()

    res = client.put(f"/routines/days/{did}", headers=cli["headers"], json={"name": "Mio"})
    assert res.status_code == 404
    assert _nombre_del_dia(client, coach["headers"], rid) == "Pecho"


def test_dia_inexistente_da_404(client, db_session):
    u = make_user(client, "dia8@test.com")
    _rutina_con_dia(client, u["headers"])

    res = client.put("/routines/days/999999", headers=u["headers"], json={"name": "Nada"})
    assert res.status_code == 404
