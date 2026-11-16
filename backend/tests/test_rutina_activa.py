from tests.conftest import make_user

# Antes "la rutina activa" del dashboard era db.query(...).first(): la mas
# vieja del usuario, sin que nadie la eligiera. Ahora es una bandera.


def _rutina(client, headers, ejercicios, name="Base"):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": "Dia 1", "focus": "full", "exercises": [
            {"exercise_id": ejercicios[0], "order": 1, "sets": 3,
             "reps_min": 8, "reps_max": 12, "rest_seconds": 90},
        ]}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def _activa_del_dashboard(client, headers):
    res = client.get("/dashboard/summary", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["active_routine_id"]


def test_activar_marca_la_rutina(client, seed_exercises):
    u = make_user(client, "activa1@test.com")
    r = _rutina(client, u["headers"], seed_exercises, name="Nueva")

    res = client.put(f"/routines/{r['id']}/activate", headers=u["headers"])
    assert res.status_code == 200, res.text
    assert res.json()["is_active"] is True

    detalle = client.get(f"/routines/{r['id']}", headers=u["headers"]).json()
    assert detalle["is_active"] is True


def test_solo_puede_haber_una_activa(client, seed_exercises):
    u = make_user(client, "activa2@test.com")
    vieja = _rutina(client, u["headers"], seed_exercises, name="Vieja")
    nueva = _rutina(client, u["headers"], seed_exercises, name="Nueva")

    client.put(f"/routines/{vieja['id']}/activate", headers=u["headers"])
    client.put(f"/routines/{nueva['id']}/activate", headers=u["headers"])

    lista = {r["id"]: r for r in client.get("/routines", headers=u["headers"]).json()}
    assert lista[nueva["id"]]["is_active"] is True
    assert lista[vieja["id"]]["is_active"] is False


def test_el_dashboard_respeta_la_marcada_no_la_mas_vieja(client, seed_exercises):
    u = make_user(client, "activa3@test.com")
    vieja = _rutina(client, u["headers"], seed_exercises, name="Vieja")
    nueva = _rutina(client, u["headers"], seed_exercises, name="Nueva")

    # Sin marcar nada, manda la mas reciente: es la apuesta menos mala.
    assert _activa_del_dashboard(client, u["headers"]) == nueva["id"]

    client.put(f"/routines/{vieja['id']}/activate", headers=u["headers"])
    assert _activa_del_dashboard(client, u["headers"]) == vieja["id"]


def test_no_se_puede_activar_la_rutina_de_otro(client, seed_exercises):
    u = make_user(client, "activa4@test.com")
    otro = make_user(client, "activa4b@test.com")
    r = _rutina(client, u["headers"], seed_exercises)

    res = client.put(f"/routines/{r['id']}/activate", headers=otro["headers"])
    assert res.status_code == 404


def test_una_plantilla_de_cliente_no_puede_ser_tu_rutina_activa(client, seed_exercises):
    """Las rutinas de cliente viven en el panel de coach; uno no las entrena."""
    u = make_user(client, "activa5@test.com")
    res = client.post("/coach/routines", headers=u["headers"], json={
        "name": "Para cliente", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1, "days": [],
    })
    assert res.status_code == 201, res.text
    plantilla = res.json()

    res = client.put(f"/routines/{plantilla['id']}/activate", headers=u["headers"])
    assert res.status_code == 400


def test_el_dashboard_ignora_las_plantillas_de_cliente(client, seed_exercises):
    u = make_user(client, "activa6@test.com")
    client.post("/coach/routines", headers=u["headers"], json={
        "name": "Para cliente", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1, "days": [],
    })
    mia = _rutina(client, u["headers"], seed_exercises, name="Mia")

    assert _activa_del_dashboard(client, u["headers"]) == mia["id"]


def test_sin_rutinas_el_dashboard_no_truena(client):
    u = make_user(client, "activa7@test.com")
    assert _activa_del_dashboard(client, u["headers"]) is None
