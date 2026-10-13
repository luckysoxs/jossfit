# Editar el nombre de un dia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueno de una rutina pueda renombrar un dia de entrenamiento desde la pantalla del dia.

**Architecture:** Un endpoint `PUT /routines/days/{routine_day_id}` que renombra el dia tras validar dueno y nombre, y el titulo de `RoutineDayDetail.jsx` convertido en campo editable con el mismo gesto que el nombre de la rutina en `RoutineDetail.jsx`.

**Tech Stack:** FastAPI + SQLAlchemy 2 (backend, pytest con SQLite en memoria), React + Vite + Tailwind (frontend, vitest + Testing Library).

Spec: `docs/superpowers/specs/2026-10-12-editar-nombre-dia-design.md`

## Global Constraints

- `RoutineDay.name` es `String(100)`: el nombre se recorta a 100 caracteres.
- Nombre vacio o de solo espacios: 400 `"Escribe un nombre para el dia"`.
- Un nombre que empiece con un dia de la semana seguido de guion se rechaza con
  400 `"El dia de la semana se pone solo; escribe solo el nombre"`. La
  comparacion ignora acentos y mayusculas.
- Solo el dueno de la rutina renombra; cualquier otro, incluido un cliente con
  la rutina asignada, recibe 404 `"Day not found"`.
- El endpoint responde `{"ok": true, "name": "<nombre guardado>"}`.
- El nombre editable es solo `day.name`. El prefijo del dia de la semana lo
  calcula el frontend con `getWeekdayMap` y nunca entra al campo.
- Comentarios e identificadores en espanol sin acentos; textos de interfaz en
  espanol, como el resto del repo.
- Comandos backend desde `fitness-app/backend`: `venv/Scripts/python -m pytest ...`
- Comandos frontend desde `fitness-app/frontend`: `npm test`, `npm run build`.

---

### Task 1: Endpoint para renombrar un dia

**Files:**
- Modify: `backend/app/schemas/routine.py` (agregar `RoutineDayUpdate` al final)
- Modify: `backend/app/routers/routines.py` (helpers + endpoint nuevo justo antes de `@router.post("/days/{routine_day_id}/exercises")`)
- Test: `backend/tests/test_routine_day_rename.py`

**Interfaces:**
- Produces: `PUT /routines/days/{routine_day_id}` con body `{"name": "<texto>"}` → 200 `{"ok": true, "name": "<nombre guardado>"}`. Errores: 400 con `detail` de texto, 404 `"Day not found"`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_routine_day_rename.py`:

```python
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


@pytest.mark.parametrize("nombre", [
    "Lunes - Pecho",
    "lunes - pecho",
    "Miercoles - Pierna",
    "miércoles - pierna",
    "Sábado  -  Brazo",
])
def test_prefijo_de_dia_de_la_semana_da_400(client, db_session, nombre):
    u = make_user(client, f"dia3{len(nombre)}{nombre[0].lower()}@test.com")
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_routine_day_rename.py -v`
Expected: FAIL. Las pruebas reciben 405 o 404 del router porque la ruta `PUT /routines/days/{id}` no existe (p. ej. `assert 405 == 200`).

- [ ] **Step 3: Add the schema**

Al final de `backend/app/schemas/routine.py`:

```python
class RoutineDayUpdate(BaseModel):
    name: str
```

- [ ] **Step 4: Add the helpers and the endpoint**

En `backend/app/routers/routines.py`, agregar `unicodedata` a los imports de la
cabecera y `RoutineDayUpdate` al import del schema:

```python
import unicodedata
```

```python
from app.schemas.routine import (
    RoutineCreate, RoutineDayUpdate, RoutineDuplicate, RoutineExerciseCreate,
    RoutineExerciseUpdate, RoutineResponse,
)
```

Luego, justo antes de `@router.post("/days/{routine_day_id}/exercises")`:

```python
DAY_NAME_MAX = 100  # largo de la columna RoutineDay.name

_DIAS_SEMANA = ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")


def _sin_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def _empieza_con_dia_semana(nombre: str) -> bool:
    """True si el nombre trae el prefijo del dia de la semana: 'Lunes - Pecho'.

    El frontend ya pinta ese prefijo a partir de los dias de descanso, asi que
    guardarlo en el nombre daria 'Lunes - Lunes - Pecho'.
    """
    limpio = _sin_acentos(nombre).strip().lower()
    for dia in _DIAS_SEMANA:
        if limpio.startswith(dia) and limpio[len(dia):].lstrip().startswith("-"):
            return True
    return False


@router.put("/days/{routine_day_id}", status_code=200)
def rename_day(
    routine_day_id: int,
    data: RoutineDayUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Renombra un dia de una rutina propia.

    El filtro por Routine.user_id deja fuera al cliente con la rutina
    asignada: recibe 404, igual que en el resto de la escritura de rutinas.
    """
    day = (
        db.query(RoutineDay)
        .join(Routine)
        .filter(RoutineDay.id == routine_day_id, Routine.user_id == user.id)
        .first()
    )
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    nombre = (data.name or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Escribe un nombre para el dia")
    if _empieza_con_dia_semana(nombre):
        raise HTTPException(
            status_code=400,
            detail="El dia de la semana se pone solo; escribe solo el nombre",
        )

    day.name = nombre[:DAY_NAME_MAX]
    db.commit()
    return {"ok": True, "name": day.name}
```

- [ ] **Step 5: Run the new tests and the full suite**

Run: `venv/Scripts/python -m pytest tests/test_routine_day_rename.py -v`
Expected: 16 passed (los parametrizados cuentan uno por caso).

Run: `venv/Scripts/python -m pytest -q`
Expected: todo en verde, sin regresiones ni warnings nuevos.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/routine.py backend/app/routers/routines.py backend/tests/test_routine_day_rename.py
git commit -m "feat: endpoint para renombrar un dia de entrenamiento"
```

---

### Task 2: Titulo editable en la pantalla del dia

**Files:**
- Modify: `frontend/src/pages/RoutineDayDetail.jsx`
- Test: `frontend/src/pages/RoutineDayDetail.test.jsx`

**Interfaces:**
- Consumes: `PUT /routines/days/{day_id}` con `{ name }` de Task 1; responde `{ ok: true, name }`, o un error con `detail` de texto.

- [ ] **Step 1: Write the failing test**

`frontend/src/pages/RoutineDayDetail.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoutineDayDetail from './RoutineDayDetail'
import api from '../services/api'

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

vi.mock('../services/offlineCache', () => ({
  cacheSet: vi.fn(),
  cacheGet: vi.fn(() => null),
  queueAction: vi.fn(),
}))

vi.mock('../hooks/useOnlineStatus', () => ({ default: () => true }))

vi.mock('../contexts/RestTimerContext', () => ({
  useRestTimer: () => ({
    timeLeft: 0, totalSeconds: 0, isRunning: false, progress: 0,
    startTimer: vi.fn(), stopTimer: vi.fn(),
  }),
}))

vi.mock('../contexts/WeightUnitContext', () => ({
  useWeightUnit: () => ({ unit: 'kg', displayWeight: (kg) => kg, toKg: (v) => v }),
}))

vi.mock('../components/ui/PageTour', () => ({ default: () => null }))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '1', dayId: '10' }),
  useNavigate: () => vi.fn(),
}))

function rutina(extra = {}) {
  return {
    id: 1,
    name: 'Rutina',
    split_type: 'full_body',
    days_per_week: 1,
    rest_weekdays: [6],
    generation_type: 'normal',
    ai_data: null,
    read_only: false,
    days: [{ id: 10, day_number: 1, name: 'Pecho', focus: 'chest', exercises: [] }],
    ...extra,
  }
}

function montar(datos = rutina()) {
  api.get.mockImplementation((url) => {
    if (url === '/routines/1') return Promise.resolve({ data: datos })
    if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
    if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
    return Promise.resolve({ data: [] })
  })
  api.put.mockResolvedValue({ data: { ok: true, name: 'Empuje' } })
  render(<RoutineDayDetail />)
  return screen.findByRole('button', { name: /Editar el nombre del dia/i })
}

describe('RoutineDayDetail - nombre del dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('al tocar el titulo abre el campo con el nombre del dia, sin el dia de la semana', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    expect(campo).toHaveValue('Pecho')
  })

  it('Enter guarda el nombre nuevo y recarga la rutina', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Empuje{Enter}')

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/routines/days/10', { name: 'Empuje' }))
    await waitFor(() => {
      const pedidos = api.get.mock.calls.filter(([url]) => url === '/routines/1')
      expect(pedidos.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('Escape cierra el campo sin llamar al servidor', async () => {
    const boton = await montar()
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Otro{Escape}')

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Nombre del dia' })).toBeNull())
    expect(api.put).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor y deja el campo abierto', async () => {
    const boton = await montar()
    api.put.mockRejectedValue({
      response: { data: { detail: 'El dia de la semana se pone solo; escribe solo el nombre' } },
    })
    await userEvent.click(boton)

    const campo = screen.getByRole('textbox', { name: 'Nombre del dia' })
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Lunes - Pecho{Enter}')

    expect(await screen.findByText('El dia de la semana se pone solo; escribe solo el nombre')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nombre del dia' })).toBeInTheDocument()
  })

  it('en una rutina de coach no hay boton para editar el titulo', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/routines/1') return Promise.resolve({ data: rutina({ read_only: true }) })
      if (url === '/workouts/progress/1') return Promise.resolve({ data: {} })
      if (url === '/workouts/today-summary') return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })
    render(<RoutineDayDetail />)

    expect(await screen.findByText(/Pecho/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar el nombre del dia/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDayDetail.test.jsx`
Expected: FAIL. `Unable to find an accessible element with the role "button" and name /Editar el nombre del dia/i`, porque el titulo es un `<h2>` sin boton.

- [ ] **Step 3: Add the state and the save handler**

En `frontend/src/pages/RoutineDayDetail.jsx`, junto al resto del estado (debajo
de `const [personalBests, setPersonalBests] = useState({})`):

```jsx
  // Nombre del dia editable, mismo gesto que el nombre de la rutina.
  const [editingDayName, setEditingDayName] = useState(false)
  const [dayNameInput, setDayNameInput] = useState('')
  const [dayNameError, setDayNameError] = useState('')
  const cancelDayNameRef = useRef(false)
```

Y junto a los demas handlers, despues de `reloadRoutine`:

```jsx
  const guardarNombreDia = async (dayDbId) => {
    const nombre = dayNameInput.trim()
    if (!nombre) {
      setEditingDayName(false)
      setDayNameError('')
      return
    }
    try {
      await api.put(`/routines/days/${dayDbId}`, { name: nombre })
      await reloadRoutine()
      setEditingDayName(false)
      setDayNameError('')
    } catch (err) {
      const detail = err.response?.data?.detail
      setDayNameError(typeof detail === 'string' ? detail : 'No pudimos guardar el nombre')
    }
  }
```

- [ ] **Step 4: Make the title editable**

Reemplazar, en el `<div className="card">` del encabezado,
`<h2 className="text-lg font-bold">{dayTitle}</h2>` por:

```jsx
          {editingDayName ? (
            <form onSubmit={(e) => { e.preventDefault(); guardarNombreDia(day.id) }} className="flex-1">
              <input
                autoFocus
                maxLength={100}
                aria-label="Nombre del dia"
                className="input text-lg font-bold py-1 w-full"
                value={dayNameInput}
                onChange={(e) => setDayNameInput(e.target.value)}
                onBlur={() => {
                  if (cancelDayNameRef.current) {
                    cancelDayNameRef.current = false
                    setEditingDayName(false)
                    setDayNameError('')
                    return
                  }
                  guardarNombreDia(day.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    cancelDayNameRef.current = true
                    setEditingDayName(false)
                    setDayNameError('')
                  }
                }}
              />
            </form>
          ) : readOnly ? (
            <h2 className="text-lg font-bold">{dayTitle}</h2>
          ) : (
            <button
              onClick={() => { setDayNameInput(day.name); setEditingDayName(true); setDayNameError('') }}
              aria-label="Editar el nombre del dia"
              className="flex items-center gap-2 text-left group"
            >
              <h2 className="text-lg font-bold">{dayTitle}</h2>
              <Pencil size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
          )}
```

Y debajo de ese `<div className="flex items-center justify-between">` que cierra
el renglon del titulo, antes de la linea de `day.focus`:

```jsx
        {dayNameError && <p className="text-xs text-red-500 mt-1">{dayNameError}</p>}
```

`Pencil` y `useRef` ya estan importados en el archivo; no hay imports nuevos.

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDayDetail.test.jsx`
Expected: 5 passed

Run: `npm test`
Expected: todo en verde.

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RoutineDayDetail.jsx frontend/src/pages/RoutineDayDetail.test.jsx
git commit -m "feat: renombrar un dia desde la pantalla del dia"
```
