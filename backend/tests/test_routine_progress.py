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


def test_progreso_de_dias_previos_sigue_visible_en_la_semana(client, db_session):
    """El bug: al pasar de lunes a jueves se perdian los marcados del lunes.

    Las filas diarias que quedaron de antes del cambio a progreso semanal se
    fusionan en la lectura, y el siguiente PUT las consolida en la fila del lunes.
    """
    from app.models.routine_progress import RoutineProgress
    from app.utils.timezone import today_mx, week_start_mx

    u = make_user(client, "p4@test.com")
    rid = _make_routine(client, u["headers"])

    # Fila "del lunes" al estilo viejo (una por dia entrenado).
    db_session.add(RoutineProgress(
        user_id=u["user"]["id"], routine_id=rid,
        date=week_start_mx(), checked_data={"1": True},
    ))
    db_session.commit()

    # Se marca otro ejercicio hoy: lo del lunes debe seguir ahi.
    client.put(f"/workouts/progress/{rid}", headers=u["headers"], json={"1": True, "5": True})
    assert client.get(f"/workouts/progress/{rid}", headers=u["headers"]).json() == {"1": True, "5": True}

    # Y solo debe quedar una fila por semana, la del lunes.
    filas = (
        db_session.query(RoutineProgress)
        .filter(RoutineProgress.user_id == u["user"]["id"], RoutineProgress.routine_id == rid)
        .all()
    )
    assert [f.date for f in filas] == [week_start_mx()]


def test_progreso_se_resetea_a_la_semana_siguiente(client, db_session):
    """Lo de la semana pasada no arrastra: la fila vieja no se lee."""
    from datetime import timedelta
    from app.models.routine_progress import RoutineProgress
    from app.utils.timezone import week_start_mx

    u = make_user(client, "p5@test.com")
    rid = _make_routine(client, u["headers"])
    db_session.add(RoutineProgress(
        user_id=u["user"]["id"], routine_id=rid,
        date=week_start_mx() - timedelta(days=7), checked_data={"1": True, "2": True},
    ))
    db_session.commit()

    assert client.get(f"/workouts/progress/{rid}", headers=u["headers"]).json() == {}


def test_desmarcar_no_reaparece(client):
    """Desmarcar un ejercicio de un dia previo se respeta (no lo revive el merge)."""
    u = make_user(client, "p6@test.com")
    rid = _make_routine(client, u["headers"])
    client.put(f"/workouts/progress/{rid}", headers=u["headers"], json={"1": True, "2": True})
    client.put(f"/workouts/progress/{rid}", headers=u["headers"], json={"1": True})
    assert client.get(f"/workouts/progress/{rid}", headers=u["headers"]).json() == {"1": True}
