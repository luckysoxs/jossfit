from datetime import timedelta

from tests.conftest import make_user
from app.models.workout import Workout, WorkoutSet
from app.utils.timezone import today_mx

# El historial que alimenta la grafica de progreso de un ejercicio: un punto
# por dia entrenado, con el peso mas alto, el volumen y el 1RM estimado, para
# que el frontend pueda cambiar entre las tres metricas sin volver a pedir.


def _entreno(db_session, user_id, exercise_id, dia, series, completed=True):
    """Un entrenamiento con varias series. `series` es [(peso, reps), ...]."""
    w = Workout(user_id=user_id, date=dia)
    db_session.add(w)
    db_session.flush()
    for i, (peso, reps) in enumerate(series, start=1):
        db_session.add(WorkoutSet(
            workout_id=w.id, exercise_id=exercise_id, set_number=i,
            reps=reps, weight_kg=peso, completed=completed,
        ))
    db_session.commit()
    return w.id


def _pedir(client, u, exercise_id, **params):
    return client.get(
        f"/workouts/exercise-history/{exercise_id}",
        params=params,
        headers=u["headers"],
    )


def test_un_punto_por_dia_con_peso_volumen_y_1rm(client, db_session, seed_exercises):
    u = make_user(client, "hist1@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(80.0, 10), (100.0, 5), (90.0, 8)])

    res = _pedir(client, u, ex)
    assert res.status_code == 200, res.text
    cuerpo = res.json()
    assert cuerpo["exercise_id"] == ex
    assert cuerpo["exercise_name"]
    assert len(cuerpo["points"]) == 1

    p = cuerpo["points"][0]
    assert p["date"] == hoy.isoformat()
    assert p["max_weight"] == 100.0
    # 80*10 + 100*5 + 90*8 = 800 + 500 + 720
    assert p["volume"] == 2020.0
    assert p["total_reps"] == 23
    assert p["sets"] == [
        {"reps": 10, "weight_kg": 80.0},
        {"reps": 5, "weight_kg": 100.0},
        {"reps": 8, "weight_kg": 90.0},
    ]
    # Epley 100*(1+5/30)=116.7, Brzycki 100*36/32=112.5 -> promedio 114.6
    assert p["est_1rm"] == 114.6


def test_los_puntos_van_del_mas_viejo_al_mas_nuevo(client, db_session, seed_exercises):
    u = make_user(client, "hist2@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 5)])
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=10), [(80.0, 5)])
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=5), [(90.0, 5)])

    puntos = _pedir(client, u, ex).json()["points"]
    assert [p["max_weight"] for p in puntos] == [80.0, 90.0, 100.0]


def test_days_acota_el_rango(client, db_session, seed_exercises):
    u = make_user(client, "hist3@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=200), [(60.0, 5)])
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=10), [(90.0, 5)])

    de30 = _pedir(client, u, ex, days=30).json()["points"]
    assert [p["max_weight"] for p in de30] == [90.0]

    de365 = _pedir(client, u, ex, days=365).json()["points"]
    assert [p["max_weight"] for p in de365] == [60.0, 90.0]


def test_sin_days_devuelve_todo_el_historial(client, db_session, seed_exercises):
    u = make_user(client, "hist4@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=900), [(50.0, 5)])
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 5)])

    puntos = _pedir(client, u, ex).json()["points"]
    assert [p["max_weight"] for p in puntos] == [50.0, 100.0]


def test_ignora_las_series_no_completadas(client, db_session, seed_exercises):
    u = make_user(client, "hist5@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 5)], completed=False)
    _entreno(db_session, u["user"]["id"], ex, hoy - timedelta(days=1), [(70.0, 5)])

    puntos = _pedir(client, u, ex).json()["points"]
    assert [p["max_weight"] for p in puntos] == [70.0]


def test_ignora_otros_ejercicios_y_otros_usuarios(client, db_session, seed_exercises):
    u = make_user(client, "hist6@test.com")
    otro = make_user(client, "hist6b@test.com")
    ex, ex2 = seed_exercises[0], seed_exercises[1]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 5)])
    _entreno(db_session, u["user"]["id"], ex2, hoy, [(55.0, 5)])
    _entreno(db_session, otro["user"]["id"], ex, hoy, [(200.0, 5)])

    puntos = _pedir(client, u, ex).json()["points"]
    assert len(puntos) == 1
    assert puntos[0]["max_weight"] == 100.0


def test_sin_historial_devuelve_lista_vacia_no_404(client, seed_exercises):
    u = make_user(client, "hist7@test.com")
    res = _pedir(client, u, seed_exercises[0])
    assert res.status_code == 200
    assert res.json()["points"] == []
    assert res.json()["exercise_name"]


def test_ejercicio_inexistente_da_404(client):
    u = make_user(client, "hist8@test.com")
    res = _pedir(client, u, 999999)
    assert res.status_code == 404


def test_sin_1rm_cuando_las_reps_pasan_de_diez(client, db_session, seed_exercises):
    """Las formulas se deforman con reps altas; mejor no dibujar el punto."""
    u = make_user(client, "hist9@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(40.0, 20), (40.0, 15)])

    p = _pedir(client, u, ex).json()["points"][0]
    assert p["est_1rm"] is None
    assert p["max_weight"] == 40.0
    assert p["volume"] == 1400.0


def test_el_1rm_sale_de_la_mejor_serie_no_de_la_mas_pesada(client, db_session, seed_exercises):
    """90x8 estima mas que 100x1, y es lo que de verdad demuestra la fuerza."""
    u = make_user(client, "hist10@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 1), (90.0, 8)])

    p = _pedir(client, u, ex).json()["points"][0]
    assert p["max_weight"] == 100.0
    # Epley 90*(1+8/30)=114.0, Brzycki 90*36/29=111.7. El promedio cae en
    # 112.84999... en coma flotante, asi que redondea a 112.8 y no a 112.9.
    assert p["est_1rm"] == 112.8


def test_ignora_entrenos_con_fecha_futura(client, db_session, seed_exercises):
    u = make_user(client, "hist11@test.com")
    ex = seed_exercises[0]
    hoy = today_mx()
    _entreno(db_session, u["user"]["id"], ex, hoy + timedelta(days=3), [(300.0, 5)])
    _entreno(db_session, u["user"]["id"], ex, hoy, [(100.0, 5)])

    puntos = _pedir(client, u, ex).json()["points"]
    assert [p["max_weight"] for p in puntos] == [100.0]
