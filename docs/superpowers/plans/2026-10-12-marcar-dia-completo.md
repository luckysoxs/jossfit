# Marcar el dia completo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un boton que registra de golpe todos los ejercicios de fuerza pendientes de un dia, copiando el peso y las reps de la ultima vez que el usuario hizo cada ejercicio.

**Architecture:** Dos endpoints nuevos en `routers/workouts.py` — uno que devuelve la ultima serie de cada ejercicio y otro que guarda varias series en una transaccion — y, en la pantalla del dia, un boton que abre un resumen editable y manda una sola peticion.

**Tech Stack:** FastAPI + SQLAlchemy 2 (backend, pytest con SQLite en memoria), React + Vite + Tailwind (frontend, vitest + Testing Library).

Spec: `docs/superpowers/specs/2026-10-12-marcar-dia-completo-design.md`

## Global Constraints

- `GET /workouts/last-sets` devuelve la **ultima** serie completada de cada
  ejercicio (por `Workout.date` desc, y a igual fecha por `WorkoutSet.id` desc),
  no la mas pesada. Forma de cada item: `{"exercise_id": int, "weight_kg": float, "reps": int}`.
- `POST /workouts/bulk-sets` guarda todas las series en el entrenamiento de hoy
  (`today_mx()`), creandolo si no existe, con `set_number` correlativo a las
  series que ese entrenamiento ya tenga, y `completed=True`.
- El 1RM (`OneRepMax`) se registra solo cuando `1 <= reps <= 10` y `weight_kg > 0`.
- `weight_kg == 0` es valido: es el peso real de dominadas, fondos o plancha.
- Errores de `bulk-sets`, todos 400 y sin guardar nada: lista vacia
  `"No hay series para guardar"`; mas de 50 series
  `"Demasiadas series en una sola peticion"`; `reps < 1` o `weight_kg < 0`
  `"Peso o repeticiones invalidos"`.
- Respuesta de `bulk-sets`: `{"ok": true, "saved": <cuantas>, "workout_id": <id>}`.
- Las rutas estaticas van ANTES de las parametrizadas en `routers/workouts.py`:
  `GET /{workout_id}` esta al final del archivo y no debe quedar antes de las nuevas.
- El cardio no participa: se detecta con el `isCardioExercise` que ya existe en
  `RoutineDayDetail.jsx` (`muscle_group === 'cardio' && category === 'cardio'`).
- Un ejercicio sin historial entra con las reps de `reps_min` del ejercicio en la
  rutina y peso editable que arranca en 0.
- Comentarios e identificadores en espanol sin acentos; textos de interfaz en
  espanol.
- Comandos backend desde `fitness-app/backend`: `venv/Scripts/python -m pytest ...`
- Comandos frontend desde `fitness-app/frontend`: `npm test`, `npm run build`.

---

### Task 1: Endpoint `GET /workouts/last-sets`

**Files:**
- Modify: `backend/app/routers/workouts.py` (endpoint nuevo justo despues de `get_personal_bests`, antes de `@router.get("/today-exercises")`)
- Test: `backend/tests/test_workouts_last_sets.py`

**Interfaces:**
- Produces: `GET /workouts/last-sets` → 200, lista de `{"exercise_id": int, "weight_kg": float, "reps": int}`, un item por ejercicio con historial.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_workouts_last_sets.py`:

```python
from datetime import timedelta

from tests.conftest import make_user
from app.models.workout import Workout, WorkoutSet
from app.utils.timezone import today_mx


def _serie(db_session, user_id, exercise_id, weight, reps, dia, completed=True):
    """Crea un entrenamiento con una serie. Devuelve el id de la serie."""
    w = Workout(user_id=user_id, date=dia)
    db_session.add(w)
    db_session.flush()
    s = WorkoutSet(
        workout_id=w.id, exercise_id=exercise_id, set_number=1,
        reps=reps, weight_kg=weight, completed=completed,
    )
    db_session.add(s)
    db_session.commit()
    return s.id


def _por_ejercicio(res):
    return {item["exercise_id"]: item for item in res.json()}


def test_devuelve_la_ultima_serie_no_la_mas_pesada(client, db_session, seed_exercises):
    u = make_user(client, "last1@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 100.0, 5, hoy - timedelta(days=2))
    _serie(db_session, u["user"]["id"], ex, 80.0, 8, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.status_code == 200, res.text
    fila = _por_ejercicio(res)[ex]
    assert fila["weight_kg"] == 80.0
    assert fila["reps"] == 8


def test_desempata_por_id_cuando_es_el_mismo_dia(client, db_session, seed_exercises):
    u = make_user(client, "last2@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 60.0, 12, hoy)
    _serie(db_session, u["user"]["id"], ex, 65.0, 10, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    fila = _por_ejercicio(res)[ex]
    assert fila["weight_kg"] == 65.0
    assert fila["reps"] == 10


def test_ignora_series_no_completadas(client, db_session, seed_exercises):
    u = make_user(client, "last3@test.com")
    hoy = today_mx()
    ex = seed_exercises[0]
    _serie(db_session, u["user"]["id"], ex, 70.0, 10, hoy - timedelta(days=1))
    _serie(db_session, u["user"]["id"], ex, 999.0, 1, hoy, completed=False)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert _por_ejercicio(res)[ex]["weight_kg"] == 70.0


def test_un_item_por_ejercicio(client, db_session, seed_exercises):
    u = make_user(client, "last4@test.com")
    hoy = today_mx()
    _serie(db_session, u["user"]["id"], seed_exercises[0], 50.0, 10, hoy)
    _serie(db_session, u["user"]["id"], seed_exercises[0], 55.0, 9, hoy)
    _serie(db_session, u["user"]["id"], seed_exercises[1], 90.0, 6, hoy)

    res = client.get("/workouts/last-sets", headers=u["headers"])
    por_ex = _por_ejercicio(res)
    assert len(res.json()) == 2
    assert por_ex[seed_exercises[0]]["weight_kg"] == 55.0
    assert por_ex[seed_exercises[1]]["weight_kg"] == 90.0


def test_no_devuelve_series_de_otro_usuario(client, db_session, seed_exercises):
    u = make_user(client, "last5@test.com")
    otro = make_user(client, "last5o@test.com")
    _serie(db_session, otro["user"]["id"], seed_exercises[0], 120.0, 3, today_mx())

    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.json() == []


def test_sin_historial_devuelve_lista_vacia(client, seed_exercises):
    u = make_user(client, "last6@test.com")
    res = client.get("/workouts/last-sets", headers=u["headers"])
    assert res.status_code == 200
    assert res.json() == []


def test_sin_token_da_401(client):
    assert client.get("/workouts/last-sets").status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_workouts_last_sets.py -v`
Expected: FAIL. La ruta no existe, asi que FastAPI intenta `GET /workouts/{workout_id}` con `workout_id="last-sets"` y responde 422, o 404; en cualquier caso `assert 422 == 200`.

- [ ] **Step 3: Write the implementation**

En `backend/app/routers/workouts.py`, justo despues de la funcion
`get_personal_bests` y antes de `@router.get("/today-exercises")`:

```python
@router.get("/last-sets")
def get_last_sets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """La ultima serie completada de cada ejercicio.

    Lo que el usuario cargo la vez pasada, no su record: eso lo da
    /personal-bests. Se ordena por fecha del entrenamiento y, a igual fecha,
    por id de la serie, que es el orden en que se registraron.
    """
    rows = (
        db.query(
            WorkoutSet.exercise_id,
            WorkoutSet.weight_kg,
            WorkoutSet.reps,
        )
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .filter(Workout.user_id == user.id, WorkoutSet.completed == True)  # noqa: E712
        .order_by(Workout.date.desc(), WorkoutSet.id.desc())
        .all()
    )

    ultimos = {}
    for exercise_id, weight_kg, reps in rows:
        if exercise_id not in ultimos:
            ultimos[exercise_id] = {
                "exercise_id": exercise_id,
                "weight_kg": weight_kg,
                "reps": reps,
            }
    return list(ultimos.values())
```

- [ ] **Step 4: Run the tests**

Run: `venv/Scripts/python -m pytest tests/test_workouts_last_sets.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/workouts.py backend/tests/test_workouts_last_sets.py
git commit -m "feat: endpoint con la ultima serie de cada ejercicio"
```

---

### Task 2: Endpoint `POST /workouts/bulk-sets`

**Files:**
- Modify: `backend/app/schemas/workout.py` (dos schemas nuevos al final)
- Modify: `backend/app/routers/workouts.py` (import del schema + endpoint nuevo justo despues de `log_quick_set`)
- Test: `backend/tests/test_workouts_bulk_sets.py`

**Interfaces:**
- Produces: `POST /workouts/bulk-sets` con body `{"sets": [{"exercise_id": int, "weight_kg": float, "reps": int}, ...]}` → 201 `{"ok": true, "saved": int, "workout_id": int}`. Errores 400 con los `detail` exactos de Global Constraints.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_workouts_bulk_sets.py`:

```python
from tests.conftest import make_user
from app.models.workout import Workout, WorkoutSet
from app.models.one_rep_max import OneRepMax
from app.utils.timezone import today_mx


def _bulk(client, headers, sets):
    return client.post("/workouts/bulk-sets", headers=headers, json={"sets": sets})


def _series_de_hoy(db_session, user_id):
    w = (
        db_session.query(Workout)
        .filter(Workout.user_id == user_id, Workout.date == today_mx())
        .first()
    )
    if not w:
        return []
    return (
        db_session.query(WorkoutSet)
        .filter(WorkoutSet.workout_id == w.id)
        .order_by(WorkoutSet.set_number)
        .all()
    )


def test_guarda_todas_las_series_en_el_entreno_de_hoy(client, db_session, seed_exercises):
    u = make_user(client, "bulk1@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
        {"exercise_id": seed_exercises[1], "weight_kg": 100.0, "reps": 5},
    ])
    assert res.status_code == 201, res.text
    cuerpo = res.json()
    assert cuerpo["ok"] is True
    assert cuerpo["saved"] == 2

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert [s.set_number for s in series] == [1, 2]
    assert [s.exercise_id for s in series] == [seed_exercises[0], seed_exercises[1]]
    assert [s.weight_kg for s in series] == [80.0, 100.0]
    assert all(s.completed for s in series)


def test_reutiliza_el_entreno_de_hoy_y_sigue_la_numeracion(client, db_session, seed_exercises):
    u = make_user(client, "bulk2@test.com")
    primera = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 60.0, "reps": 10},
    ])
    segunda = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[1], "weight_kg": 70.0, "reps": 9},
    ])
    assert segunda.status_code == 201, segunda.text
    assert primera.json()["workout_id"] == segunda.json()["workout_id"]

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert [s.set_number for s in series] == [1, 2]


def test_peso_cero_se_guarda_y_no_crea_1rm(client, db_session, seed_exercises):
    """Dominadas, fondos y plancha: 0 kg es el peso real."""
    u = make_user(client, "bulk3@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 0.0, "reps": 10},
    ])
    assert res.status_code == 201, res.text

    series = _series_de_hoy(db_session, u["user"]["id"])
    assert len(series) == 1
    assert series[0].weight_kg == 0.0

    rms = db_session.query(OneRepMax).filter(OneRepMax.user_id == u["user"]["id"]).all()
    assert rms == []


def test_con_peso_y_pocas_reps_crea_1rm(client, db_session, seed_exercises):
    u = make_user(client, "bulk4@test.com")

    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 100.0, "reps": 5},
    ])
    assert res.status_code == 201, res.text

    rms = db_session.query(OneRepMax).filter(OneRepMax.user_id == u["user"]["id"]).all()
    assert len(rms) == 1
    assert rms[0].exercise_id == seed_exercises[0]
    assert rms[0].source_weight == 100.0
    assert rms[0].source_reps == 5


def test_lista_vacia_da_400(client, db_session):
    u = make_user(client, "bulk5@test.com")
    res = _bulk(client, u["headers"], [])
    assert res.status_code == 400
    assert res.json()["detail"] == "No hay series para guardar"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_demasiadas_series_da_400(client, db_session, seed_exercises):
    u = make_user(client, "bulk6@test.com")
    sets = [{"exercise_id": seed_exercises[0], "weight_kg": 50.0, "reps": 10}] * 51
    res = _bulk(client, u["headers"], sets)
    assert res.status_code == 400
    assert res.json()["detail"] == "Demasiadas series en una sola peticion"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_reps_invalidas_no_guardan_nada(client, db_session, seed_exercises):
    """La validacion corre antes de insertar: nada queda a medias."""
    u = make_user(client, "bulk7@test.com")
    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 80.0, "reps": 8},
        {"exercise_id": seed_exercises[1], "weight_kg": 90.0, "reps": 0},
    ])
    assert res.status_code == 400
    assert res.json()["detail"] == "Peso o repeticiones invalidos"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_peso_negativo_no_guarda_nada(client, db_session, seed_exercises):
    u = make_user(client, "bulk8@test.com")
    res = _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": -5.0, "reps": 8},
    ])
    assert res.status_code == 400
    assert res.json()["detail"] == "Peso o repeticiones invalidos"
    assert _series_de_hoy(db_session, u["user"]["id"]) == []


def test_sin_token_da_401(client, seed_exercises):
    res = client.post("/workouts/bulk-sets", json={
        "sets": [{"exercise_id": seed_exercises[0], "weight_kg": 50.0, "reps": 10}],
    })
    assert res.status_code == 401


def test_las_series_guardadas_alimentan_last_sets(client, seed_exercises):
    """Lo que se marca de golpe es lo que la proxima vez sale como ultima vez."""
    u = make_user(client, "bulk9@test.com")
    _bulk(client, u["headers"], [
        {"exercise_id": seed_exercises[0], "weight_kg": 82.5, "reps": 7},
    ])

    res = client.get("/workouts/last-sets", headers=u["headers"])
    por_ex = {item["exercise_id"]: item for item in res.json()}
    assert por_ex[seed_exercises[0]]["weight_kg"] == 82.5
    assert por_ex[seed_exercises[0]]["reps"] == 7
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_workouts_bulk_sets.py -v`
Expected: FAIL con 404/405 porque la ruta no existe (p. ej. `assert 404 == 201`).

- [ ] **Step 3: Add the schemas**

Al final de `backend/app/schemas/workout.py`:

```python
class BulkSetItem(BaseModel):
    exercise_id: int
    weight_kg: float
    reps: int


class BulkSetsCreate(BaseModel):
    sets: list[BulkSetItem]
```

- [ ] **Step 4: Add the endpoint**

En `backend/app/routers/workouts.py`, cambiar el import del schema:

```python
from app.schemas.workout import BulkSetsCreate, WorkoutCreate, WorkoutResponse
```

Y justo despues de la funcion `log_quick_set`, antes de `def _load_workout`:

```python
MAX_BULK_SETS = 50


@router.post("/bulk-sets", status_code=201)
def log_bulk_sets(
    data: BulkSetsCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra varias series de golpe: marcar el dia completo.

    Misma logica que /quick-set para una sola serie, pero en una transaccion:
    o queda el dia entero, o no queda nada. La validacion corre antes de
    insertar para que un dato malo no deje series a medias.
    """
    if not data.sets:
        raise HTTPException(status_code=400, detail="No hay series para guardar")
    if len(data.sets) > MAX_BULK_SETS:
        raise HTTPException(
            status_code=400, detail="Demasiadas series en una sola peticion",
        )
    for item in data.sets:
        # 0 kg es valido: dominadas, fondos y plancha se cargan con el cuerpo.
        if item.reps < 1 or item.weight_kg < 0:
            raise HTTPException(status_code=400, detail="Peso o repeticiones invalidos")

    today = today_mx()
    workout = db.query(Workout).filter(
        Workout.user_id == user.id, Workout.date == today
    ).first()
    if not workout:
        workout = Workout(user_id=user.id, date=today)
        db.add(workout)
        db.flush()

    existing = db.query(sqlfunc.count(WorkoutSet.id)).filter(
        WorkoutSet.workout_id == workout.id
    ).scalar() or 0

    for offset, item in enumerate(data.sets, start=1):
        db.add(WorkoutSet(
            workout_id=workout.id,
            exercise_id=item.exercise_id,
            set_number=existing + offset,
            reps=item.reps,
            weight_kg=item.weight_kg,
            completed=True,
        ))
        if 1 <= item.reps <= 10 and item.weight_kg > 0:
            epley = calculate_1rm_epley(item.weight_kg, item.reps)
            brzycki = calculate_1rm_brzycki(item.weight_kg, item.reps)
            db.add(OneRepMax(
                user_id=user.id,
                exercise_id=item.exercise_id,
                estimated_1rm=round((epley + brzycki) / 2, 1),
                formula_used="average",
                date=today,
                source_weight=item.weight_kg,
                source_reps=item.reps,
            ))

    db.commit()
    return {"ok": True, "saved": len(data.sets), "workout_id": workout.id}
```

- [ ] **Step 5: Run the new tests and the full suite**

Run: `venv/Scripts/python -m pytest tests/test_workouts_bulk_sets.py -v`
Expected: 10 passed

Run: `venv/Scripts/python -m pytest -q`
Expected: todo en verde, sin warnings nuevos.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/workout.py backend/app/routers/workouts.py backend/tests/test_workouts_bulk_sets.py
git commit -m "feat: endpoint para registrar varias series de golpe"
```

---

### Task 3: Boton y resumen en la pantalla del dia

**Files:**
- Modify: `frontend/src/pages/RoutineDayDetail.jsx`
- Test: `frontend/src/pages/RoutineDayDetail.test.jsx` (archivo existente, se le agregan casos)

**Interfaces:**
- Consumes: `GET /workouts/last-sets` (Task 1) y `POST /workouts/bulk-sets` (Task 2).

- [ ] **Step 1: Write the failing test**

Agregar al final de `frontend/src/pages/RoutineDayDetail.test.jsx` un bloque
nuevo. El archivo ya tiene los mocks de `api`, `offlineCache`, `useOnlineStatus`,
los contextos, `PageTour` y `react-router-dom`, y una funcion `rutina()`; este
bloque trae su propia rutina con ejercicios y su propio montaje:

```jsx
// ─── Marcar todo el dia ───

const EX_CON_HISTORIAL = {
  id: 101, exercise_id: 1, order: 1, sets: 4, reps_min: 6, reps_max: 8,
  rest_seconds: 120, notes: null, group_id: null,
  exercise: { id: 1, name: 'Bench Press', name_es: 'Press de banca', muscle_group: 'chest', category: 'compound' },
}

const EX_SIN_HISTORIAL = {
  id: 102, exercise_id: 2, order: 2, sets: 3, reps_min: 10, reps_max: 12,
  rest_seconds: 90, notes: null, group_id: null,
  exercise: { id: 2, name: 'Cable Fly', name_es: 'Cruce de poleas', muscle_group: 'chest', category: 'isolation' },
}

function rutinaConEjercicios(extra = {}) {
  return {
    ...rutina(),
    days: [{ id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [EX_CON_HISTORIAL, EX_SIN_HISTORIAL] }],
    ...extra,
  }
}

function montarConEjercicios(datos = rutinaConEjercicios(), ultimas = [{ exercise_id: 1, weight_kg: 80, reps: 7 }]) {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: datos })
    if (url === '/workouts/last-sets') return Promise.resolve({ data: ultimas })
    if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
    if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
    return Promise.resolve({ data: [] })
  })
  api.post.mockResolvedValue({ data: { ok: true, saved: 2, workout_id: 9 } })
  render(<RoutineDayDetail />)
  return screen.findByRole('button', { name: /Marcar todo el dia/i })
}

describe('RoutineDayDetail - marcar todo el dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el resumen trae el peso y las reps de la ultima vez', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const fila = screen.getByTestId('bulk-row-101')
    expect(fila).toHaveTextContent('80')
    expect(fila).toHaveTextContent('7')
  })

  it('un ejercicio sin historial sale marcado y con el peso en 0', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const fila = screen.getByTestId('bulk-row-102')
    expect(fila).toHaveTextContent(/sin historial/i)
    expect(screen.getByLabelText('Peso de Cruce de poleas')).toHaveValue(0)
    // reps_min del ejercicio en la rutina
    expect(fila).toHaveTextContent('10')
  })

  it('confirmar manda una sola peticion con todas las series', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    expect(api.post).toHaveBeenCalledWith('/workouts/bulk-sets', {
      sets: [
        { exercise_id: 1, weight_kg: 80, reps: 7 },
        { exercise_id: 2, weight_kg: 0, reps: 10 },
      ],
    })
  })

  it('el peso que teclees para uno sin historial es el que se manda', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)

    const campo = screen.getByLabelText('Peso de Cruce de poleas')
    await userEvent.clear(campo)
    await userEvent.type(campo, '25')
    await userEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workouts/bulk-sets', {
      sets: [
        { exercise_id: 1, weight_kg: 80, reps: 7 },
        { exercise_id: 2, weight_kg: 25, reps: 10 },
      ],
    }))
  })

  it('cancelar no llama al servidor', async () => {
    const boton = await montarConEjercicios()
    await userEvent.click(boton)
    await userEvent.click(screen.getByRole('button', { name: /Cancelar/i }))

    expect(screen.queryByTestId('bulk-row-101')).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('el boton no aparece en una rutina de coach', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/routines/1') return Promise.resolve({ data: rutinaConEjercicios({ read_only: true }) })
      if (url === '/workouts/last-sets') return Promise.resolve({ data: [] })
      if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
      if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    render(<RoutineDayDetail />)

    expect(await screen.findByRole('heading', { name: 'Lunes - Pecho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Marcar todo el dia/i })).toBeNull()
  })

  it('el boton no aparece si ya no hay pendientes', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/routines/1') return Promise.resolve({ data: rutinaConEjercicios() })
      if (url === '/workouts/last-sets') return Promise.resolve({ data: [] })
      // El progreso del servidor ya trae los dos ejercicios marcados.
      if (url === '/workouts/progress/1') return Promise.resolve({ data: { 101: true, 102: true } })
      if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    render(<RoutineDayDetail />)

    expect(await screen.findByRole('heading', { name: 'Lunes - Pecho' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /Marcar todo el dia/i })).toBeNull())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDayDetail.test.jsx`
Expected: FAIL. `Unable to find an accessible element with the role "button" and name /Marcar todo el dia/i`, porque el boton no existe. Los casos que ya estaban deben seguir pasando.

- [ ] **Step 3: Load the last sets**

En `frontend/src/pages/RoutineDayDetail.jsx`, junto al estado (debajo de
`const [personalBests, setPersonalBests] = useState({})`):

```jsx
  // Ultima serie registrada de cada ejercicio: lo que se copia al marcar el
  // dia completo. Distinto de personalBests, que es el record.
  const [lastSets, setLastSets] = useState({})
  const [bulkRows, setBulkRows] = useState(null)   // null = modal cerrado
  const [bulkSaving, setBulkSaving] = useState(false)
```

En el `Promise.all` de la carga inicial, agregar la peticion y quedarse con el
resultado:

```jsx
        const [r, pb, todayEx, serverProgress, summary, lastS] = await Promise.all([
          api.get(`/routines/${id}`),
          api.get('/workouts/personal-bests').catch(() => ({ data: [] })),
          api.get('/workouts/today-exercises').catch(() => ({ data: [] })),
          api.get(`/workouts/progress/${id}`).catch(() => ({ data: {} })),
          api.get('/workouts/today-summary').catch(() => ({ data: null })),
          api.get('/workouts/last-sets').catch(() => ({ data: [] })),
        ])
```

y despues de `setPersonalBests(bests)`:

```jsx
        const ultimas = {}
        ;(lastS.data || []).forEach(s => { ultimas[s.exercise_id] = s })
        setLastSets(ultimas)
```

- [ ] **Step 4: Add the handlers**

Junto a los demas handlers, despues de `skipQuickSet`:

```jsx
  const abrirMarcarTodo = () => {
    setBulkRows(pendientesDeFuerza.map(e => {
      const ultima = lastSets[e.exercise_id]
      return {
        routineExId: e.id,
        exerciseId: e.exercise_id,
        name: exDisplayName(e.exercise),
        conHistorial: !!ultima,
        peso: ultima ? displayWeight(ultima.weight_kg).toString() : '0',
        reps: ultima ? ultima.reps : e.reps_min,
      }
    }))
  }

  const cambiarPesoBulk = (routineExId, valor) => {
    setBulkRows(filas => filas.map(f => (
      f.routineExId === routineExId ? { ...f, peso: valor } : f
    )))
  }

  const confirmarMarcarTodo = async () => {
    if (!bulkRows || bulkRows.length === 0 || bulkSaving) return
    setBulkSaving(true)
    const payload = {
      sets: bulkRows.map(f => ({
        exercise_id: f.exerciseId,
        weight_kg: toKg(parseFloat(f.peso) || 0),
        reps: f.reps,
      })),
    }
    const encolar = () => queueAction({
      method: 'post',
      url: '/workouts/bulk-sets',
      data: payload,
      description: `Dia completo: ${payload.sets.length} series`,
    })
    try {
      if (online) {
        try {
          await api.post('/workouts/bulk-sets', payload)
        } catch {
          encolar()
        }
      } else {
        encolar()
      }

      const next = { ...checked }
      bulkRows.forEach(f => { next[f.routineExId] = true })
      setChecked(next)
      localStorage.setItem(weekKey, JSON.stringify(next))

      api.get('/workouts/today-summary')
        .then(res => setTodaySummary(res.data))
        .catch(() => {})
      api.get('/workouts/last-sets')
        .then(res => {
          const ultimas = {}
          ;(res.data || []).forEach(s => { ultimas[s.exercise_id] = s })
          setLastSets(ultimas)
        })
        .catch(() => {})

      setBulkRows(null)
    } finally {
      setBulkSaving(false)
    }
  }
```

Y junto a `strengthExercises` (donde se calculan `dayExIds`, `done` y `total`):

```jsx
  const pendientesDeFuerza = strengthExercises.filter(e => !checked[e.id])
```

- [ ] **Step 5: Add the button and the modal**

En el encabezado del dia, dentro de la rama `) : (` que hoy solo tiene el boton
"Regenerar ejercicios", poner el boton nuevo ARRIBA de ese, envolviendo los dos:

```jsx
        ) : (
          <>
            {pendientesDeFuerza.length > 0 && (
              <button
                onClick={abrirMarcarTodo}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
              >
                <Check size={15} /> Marcar todo el dia
              </button>
            )}
            <button
              onClick={regenerateExercises}
              disabled={regenerating}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-orange-500 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />
              {regenerating ? 'Regenerando...' : 'Regenerar ejercicios'}
            </button>
          </>
        )}
```

Y el modal, junto a los otros modales del archivo (por ejemplo antes del de
`quickSetExercise`):

```jsx
      {bulkRows && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
          onClick={() => { if (!bulkSaving) setBulkRows(null) }}>
          <div className="card w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">Marcar todo el dia</h3>
            <p className="text-xs text-gray-400 mt-1">
              Se registra esto con tus numeros de la ultima vez. Revisa antes de guardar.
            </p>

            <div className="space-y-2 mt-3">
              {bulkRows.map(f => (
                <div key={f.routineExId} data-testid={`bulk-row-${f.routineExId}`}
                  className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{f.name}</p>
                    {!f.conHistorial && (
                      <p className="text-[11px] text-amber-500">sin historial</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {f.conHistorial ? (
                      <span className="tabular-nums">{f.peso} {unit}</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        aria-label={`Peso de ${f.name}`}
                        className="input w-20 py-1 text-right tabular-nums"
                        value={f.peso}
                        onChange={(e) => cambiarPesoBulk(f.routineExId, e.target.value)}
                      />
                    )}
                    <span className="text-gray-400">x {f.reps}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setBulkRows(null)} disabled={bulkSaving}
                className="btn-secondary flex-1 text-sm py-2">
                Cancelar
              </button>
              <button onClick={confirmarMarcarTodo} disabled={bulkSaving}
                className="btn-primary flex-1 text-sm py-2">
                {bulkSaving ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
```

`Check`, `RefreshCw`, `exDisplayName`, `displayWeight`, `toKg`, `unit`,
`queueAction` y `online` ya existen en el archivo; no hay imports nuevos.

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDayDetail.test.jsx`
Expected: 16 passed (los 9 que ya estaban mas los 7 nuevos)

Run: `npm test`
Expected: todo en verde.

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/RoutineDayDetail.jsx frontend/src/pages/RoutineDayDetail.test.jsx
git commit -m "feat: marcar todo el dia con los registros de la ultima vez"
```
