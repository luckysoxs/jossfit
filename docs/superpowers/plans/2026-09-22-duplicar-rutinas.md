# Duplicar rutinas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el coach pueda duplicar rutinas entre sus rutinas personales y las de clientes (personal → cliente, cliente → cliente, cliente → personal).

**Architecture:** Un servicio `copy_routine` copia una rutina completa (dias, ejercicios, superseries remapeadas) a una rutina nueva e independiente. Un endpoint `POST /routines/{id}/duplicate` con `destino` decide si la copia es de cliente (`is_template=True`) o personal. En el frontend, un modal reutilizable pide el nombre y lo usan el panel de coach y el detalle de rutina.

**Tech Stack:** FastAPI + SQLAlchemy 2 (backend, pytest con SQLite en memoria), React + Vite + Tailwind (frontend, vitest + Testing Library).

Spec: `docs/superpowers/specs/2026-09-22-duplicar-rutinas-design.md`

## Global Constraints

- Nombre de rutina: maximo 100 caracteres (columna `String(100)`).
- Nombre por defecto de la copia: `"<nombre original> (copia)"`.
- Solo el dueno de la rutina original puede duplicarla; cualquier otro recibe 404.
- `destino="cliente"` exige `is_coach` o `is_admin`; si no, 403.
- La copia no lleva enlaces, asignaciones, solicitudes de cambio ni entrenos.
- Textos de UI en espanol sin acentos en el codigo, como el resto de `components/coach/` (`dias`, `Duplicar`, `A mis rutinas`, `Compartir con clientes`).
- Comandos backend desde `fitness-app/backend`: `venv/Scripts/python -m pytest ...`
- Comandos frontend desde `fitness-app/frontend`: `npm test`, `npm run build`.

---

### Task 1: Servicio `copy_routine`

**Files:**
- Create: `backend/app/services/routine_copy.py`
- Test: `backend/tests/test_routine_copy.py`

**Interfaces:**
- Produces: `copy_routine(db: Session, source: Routine, owner: User, name: str | None, as_template: bool) -> Routine` (hace `flush`, no `commit`) y `NAME_MAX = 100`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_routine_copy.py`:

```python
from tests.conftest import make_user
from app.models.routine import Routine
from app.models.user import User
from app.services.routine_copy import copy_routine


def _rutina_con_superserie(client, headers, ejercicios, name="Original"):
    """Rutina de 2 dias; en el dia 1 los dos primeros ejercicios son superserie."""
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "upper_lower",
        "objective": "hypertrophy", "days_per_week": 2,
        "days": [
            {"day_number": 1, "name": "Dia 1", "focus": "upper", "exercises": [
                {"exercise_id": ejercicios[0], "order": 1, "sets": 4,
                 "reps_min": 6, "reps_max": 8, "rest_seconds": 120, "notes": "Pesado"},
                {"exercise_id": ejercicios[2], "order": 2, "sets": 3,
                 "reps_min": 10, "reps_max": 12, "rest_seconds": 60},
                {"exercise_id": ejercicios[1], "order": 3, "sets": 3,
                 "reps_min": 8, "reps_max": 10, "rest_seconds": 90},
            ]},
            {"day_number": 2, "name": "Dia 2", "focus": "lower", "exercises": [
                {"exercise_id": ejercicios[1], "order": 1, "sets": 5,
                 "reps_min": 3, "reps_max": 5, "rest_seconds": 180},
            ]},
        ],
    })
    assert res.status_code == 201, res.text
    rutina = res.json()
    dia1 = rutina["days"][0]["exercises"] if rutina["days"][0]["day_number"] == 1 else rutina["days"][1]["exercises"]
    ids = [e["id"] for e in sorted(dia1, key=lambda e: e["order"])][:2]
    res = client.put("/routines/exercises/link", headers=headers, json={"exercise_ids": ids})
    assert res.status_code == 200, res.text
    return rutina["id"]


def _foto(routine: Routine):
    """Contenido comparable de una rutina, sin IDs."""
    return [
        (d.day_number, d.name, d.focus, [
            (e.exercise_id, e.order, e.sets, e.reps_min, e.reps_max, e.rest_seconds, e.notes)
            for e in sorted(d.exercises, key=lambda e: e.order)
        ])
        for d in sorted(routine.days, key=lambda d: d.day_number)
    ]


def test_copia_todo_el_contenido(client, db_session, seed_exercises):
    u = make_user(client, "copia1@test.com")
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    db_session.query(Routine).filter(Routine.id == rid).update({"rest_weekdays": [6]})
    db_session.commit()
    source = db_session.get(Routine, rid)
    owner = db_session.get(User, u["user"]["id"])

    copia = copy_routine(db_session, source, owner, "Nueva", as_template=True)
    db_session.commit()

    assert copia.id != source.id
    assert copia.user_id == owner.id
    assert copia.name == "Nueva"
    assert copia.is_template is True
    assert copia.split_type == "upper_lower"
    assert copia.objective == "hypertrophy"
    assert copia.days_per_week == 2
    assert copia.rest_weekdays == [6]
    assert _foto(copia) == _foto(source)
    ids_orig = {e.id for d in source.days for e in d.exercises}
    ids_copia = {e.id for d in copia.days for e in d.exercises}
    assert ids_orig.isdisjoint(ids_copia)


def test_superserie_remapeada(client, db_session, seed_exercises):
    u = make_user(client, "copia2@test.com")
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises)
    source = db_session.get(Routine, rid)
    owner = db_session.get(User, u["user"]["id"])

    copia = copy_routine(db_session, source, owner, None, as_template=False)
    db_session.commit()

    def grupos(r):
        dia1 = next(d for d in r.days if d.day_number == 1)
        return [e.group_id for e in sorted(dia1.exercises, key=lambda e: e.order)]

    g_orig, g_copia = grupos(source), grupos(copia)
    assert g_orig[0] is not None and g_orig[0] == g_orig[1] and g_orig[2] is None
    assert g_copia[0] is not None and g_copia[0] == g_copia[1] and g_copia[2] is None
    assert g_copia[0] != g_orig[0]


def test_nombre_por_defecto_y_recorte(client, db_session, seed_exercises):
    u = make_user(client, "copia3@test.com")
    owner = db_session.get(User, u["user"]["id"])
    rid = _rutina_con_superserie(client, u["headers"], seed_exercises, name="Pierna")
    source = db_session.get(Routine, rid)

    assert copy_routine(db_session, source, owner, None, False).name == "Pierna (copia)"
    assert copy_routine(db_session, source, owner, "   ", False).name == "Pierna (copia)"
    assert copy_routine(db_session, source, owner, "  Mia  ", False).name == "Mia"
    assert len(copy_routine(db_session, source, owner, "x" * 150, False).name) == 100

    source.name = "y" * 100
    assert copy_routine(db_session, source, owner, None, False).name == "y" * 100
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_routine_copy.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.services.routine_copy'`

- [ ] **Step 3: Write minimal implementation**

`backend/app/services/routine_copy.py`:

```python
"""Copia de rutinas: una rutina nueva e independiente a partir de otra.

Copia dias y ejercicios. No copia enlaces, asignaciones, solicitudes de
cambio ni entrenos: la copia arranca limpia.
"""

import copy
import uuid

from sqlalchemy.orm import Session

from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.user import User

NAME_MAX = 100  # largo de la columna Routine.name


def _copy_name(original: str, name: str | None) -> str:
    nombre = (name or "").strip() or f"{original} (copia)"
    return nombre[:NAME_MAX]


def copy_routine(
    db: Session,
    source: Routine,
    owner: User,
    name: str | None,
    as_template: bool,
) -> Routine:
    """Crea la copia de `source` para `owner`. Hace flush, no commit."""
    copia = Routine(
        user_id=owner.id,
        name=_copy_name(source.name, name),
        split_type=source.split_type,
        objective=source.objective,
        days_per_week=source.days_per_week,
        generation_type=source.generation_type,
        ai_data=copy.deepcopy(source.ai_data),
        rest_weekdays=copy.deepcopy(source.rest_weekdays),
        is_template=as_template,
    )
    db.add(copia)
    db.flush()

    # Mismo grupo en la original = mismo grupo nuevo en la copia.
    grupos: dict[str, str] = {}
    for day in sorted(source.days, key=lambda d: d.day_number):
        nuevo = RoutineDay(
            routine_id=copia.id,
            day_number=day.day_number,
            name=day.name,
            focus=day.focus,
        )
        db.add(nuevo)
        db.flush()
        for ex in day.exercises:
            group_id = None
            if ex.group_id:
                group_id = grupos.setdefault(ex.group_id, str(uuid.uuid4()))
            db.add(RoutineExercise(
                routine_day_id=nuevo.id,
                exercise_id=ex.exercise_id,
                order=ex.order,
                sets=ex.sets,
                reps_min=ex.reps_min,
                reps_max=ex.reps_max,
                rest_seconds=ex.rest_seconds,
                notes=ex.notes,
                group_id=group_id,
            ))

    db.flush()
    db.refresh(copia)
    return copia
```

- [ ] **Step 4: Run test to verify it passes**

Run: `venv/Scripts/python -m pytest tests/test_routine_copy.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/routine_copy.py backend/tests/test_routine_copy.py
git commit -m "feat: servicio para copiar una rutina completa"
```

---

### Task 2: Endpoint `POST /routines/{id}/duplicate`

**Files:**
- Modify: `backend/app/schemas/routine.py` (agregar `RoutineDuplicate` al final)
- Modify: `backend/app/routers/routines.py` (import del servicio y del schema; endpoint nuevo en la seccion "Parameterised /{routine_id} routes", justo antes de `update_schedule`)
- Test: `backend/tests/test_routine_duplicate.py`

**Interfaces:**
- Consumes: `copy_routine(db, source, owner, name, as_template)` de Task 1; `_load_full_routine(db, routine_id)` ya existente en `routers/routines.py`.
- Produces: `POST /routines/{routine_id}/duplicate` con body `{"destino": "cliente" | "mia", "name": str | null}` → 201 `RoutineResponse`. Errores: 404 si no es dueno, 403 si `destino="cliente"` sin ser coach/admin, 422 si `destino` es invalido.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_routine_duplicate.py`:

```python
from tests.conftest import make_user
from app.models.coach import RoutineAssignment
from app.models.user import User


def _coach(client, db_session, email):
    u = make_user(client, email)
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    return u


def _rutina(client, headers, ejercicios, ruta="/routines", name="Base"):
    res = client.post(ruta, headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": "Dia 1", "focus": "full", "exercises": [
            {"exercise_id": ejercicios[0], "order": 1, "sets": 3,
             "reps_min": 8, "reps_max": 12, "rest_seconds": 90},
        ]}],
    })
    assert res.status_code == 201, res.text
    return res.json()


def _duplicar(client, headers, rid, **body):
    return client.post(f"/routines/{rid}/duplicate", headers=headers, json=body)


def test_personal_a_cliente(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup1@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)

    res = _duplicar(client, coach["headers"], orig["id"], destino="cliente")
    assert res.status_code == 201, res.text
    copia = res.json()
    assert copia["id"] != orig["id"]
    assert copia["is_template"] is True
    assert copia["name"] == "Base (copia)"
    assert len(copia["days"][0]["exercises"]) == 1

    ids = [r["id"] for r in client.get("/coach/routines", headers=coach["headers"]).json()]
    assert copia["id"] in ids


def test_cliente_a_cliente_sin_links_ni_clientes(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup2@test.com")
    cli = make_user(client, "dup2c@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")
    assert client.post(f"/coach/routines/{orig['id']}/links", headers=coach["headers"],
                       json={"kind": "personal"}).status_code == 201
    db_session.add(RoutineAssignment(routine_id=orig["id"], client_id=cli["user"]["id"],
                                     coach_id=coach["user"]["id"]))
    db_session.commit()

    res = _duplicar(client, coach["headers"], orig["id"], destino="cliente", name="Para Ana")
    assert res.status_code == 201, res.text
    copia = res.json()
    assert copia["name"] == "Para Ana"

    filas = {r["id"]: r for r in client.get("/coach/routines", headers=coach["headers"]).json()}
    assert filas[orig["id"]]["clients_count"] == 1
    assert filas[copia["id"]]["clients_count"] == 0
    links = client.get(f"/coach/routines/{copia['id']}/links", headers=coach["headers"]).json()
    assert links == []


def test_cliente_a_mia(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup3@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")

    res = _duplicar(client, coach["headers"], orig["id"], destino="mia")
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is False
    ids = [r["id"] for r in client.get("/routines", headers=coach["headers"]).json()]
    assert res.json()["id"] in ids


def test_copia_independiente(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup4@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)
    copia = _duplicar(client, coach["headers"], orig["id"], destino="mia").json()

    ex_copia = copia["days"][0]["exercises"][0]["id"]
    assert client.put(f"/routines/exercises/{ex_copia}", headers=coach["headers"],
                      json={"sets": 9}).status_code == 200

    otra = client.get(f"/routines/{orig['id']}", headers=coach["headers"]).json()
    assert otra["days"][0]["exercises"][0]["sets"] == 3


def test_ajeno_recibe_404(client, db_session, seed_exercises):
    dueno = _coach(client, db_session, "dup5@test.com")
    otro = _coach(client, db_session, "dup5o@test.com")
    orig = _rutina(client, dueno["headers"], seed_exercises)
    assert _duplicar(client, otro["headers"], orig["id"], destino="mia").status_code == 404


def test_cliente_asignado_recibe_404(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup6@test.com")
    cli = make_user(client, "dup6c@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises, ruta="/coach/routines")
    db_session.add(RoutineAssignment(routine_id=orig["id"], client_id=cli["user"]["id"],
                                     coach_id=coach["user"]["id"]))
    db_session.commit()
    assert _duplicar(client, cli["headers"], orig["id"], destino="mia").status_code == 404


def test_no_coach_no_crea_rutina_de_cliente(client, seed_exercises):
    u = make_user(client, "dup7@test.com")
    orig = _rutina(client, u["headers"], seed_exercises)
    assert _duplicar(client, u["headers"], orig["id"], destino="cliente").status_code == 403
    assert _duplicar(client, u["headers"], orig["id"], destino="mia").status_code == 201


def test_admin_crea_rutina_de_cliente(client, db_session, seed_exercises):
    u = make_user(client, "dup8@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    orig = _rutina(client, u["headers"], seed_exercises)
    res = _duplicar(client, u["headers"], orig["id"], destino="cliente")
    assert res.status_code == 201
    assert res.json()["is_template"] is True


def test_destino_invalido(client, db_session, seed_exercises):
    coach = _coach(client, db_session, "dup9@test.com")
    orig = _rutina(client, coach["headers"], seed_exercises)
    assert _duplicar(client, coach["headers"], orig["id"], destino="otro").status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_routine_duplicate.py -v`
Expected: FAIL; las pruebas reciben 404/405 porque la ruta no existe (`assert 405 == 201` o similar).

- [ ] **Step 3: Add the schema**

Al final de `backend/app/schemas/routine.py` (agregar `from typing import Literal` junto a los imports de arriba):

```python
class RoutineDuplicate(BaseModel):
    destino: Literal["cliente", "mia"]  # rutina para clientes o para entrenarla uno mismo
    name: str | None = None             # vacio: "<original> (copia)"
```

- [ ] **Step 4: Add the endpoint**

En `backend/app/routers/routines.py`, cambiar el import del schema:

```python
from app.schemas.routine import (
    RoutineCreate, RoutineDuplicate, RoutineExerciseCreate, RoutineExerciseUpdate, RoutineResponse,
)
```

y agregar junto a los otros imports de servicios:

```python
from app.services.routine_copy import copy_routine
```

Luego, en la seccion `# ─── Parameterised /{routine_id} routes (MUST be last) ───`, justo antes de `@router.put("/{routine_id}/schedule")`:

```python
@router.post("/{routine_id}/duplicate", response_model=RoutineResponse, status_code=201)
def duplicate_routine(
    routine_id: int,
    data: RoutineDuplicate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Copia una rutina propia a una nueva e independiente.

    destino="cliente" la deja en el panel de coach; destino="mia", en las
    rutinas propias. Solo el dueno puede copiarla: un cliente asignado
    recibe 404 igual que en el resto de los endpoints de escritura.
    """
    source = _load_full_routine(db, routine_id)
    if not source or source.user_id != user.id:
        raise HTTPException(status_code=404, detail="Routine not found")
    para_cliente = data.destino == "cliente"
    if para_cliente and not (user.is_coach or user.is_admin):
        raise HTTPException(
            status_code=403,
            detail="Necesitas ser coach para crear rutinas de clientes",
        )
    copia = copy_routine(db, source, user, data.name, as_template=para_cliente)
    db.commit()
    return _load_full_routine(db, copia.id)
```

- [ ] **Step 5: Run the new tests and the full suite**

Run: `venv/Scripts/python -m pytest tests/test_routine_duplicate.py -v`
Expected: 9 passed

Run: `venv/Scripts/python -m pytest -q`
Expected: todo en verde, sin regresiones.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/routine.py backend/app/routers/routines.py backend/tests/test_routine_duplicate.py
git commit -m "feat: endpoint para duplicar rutinas entre coach y personal"
```

---

### Task 3: Modal `DuplicateRoutineModal`

**Files:**
- Create: `frontend/src/components/routines/DuplicateRoutineModal.jsx`
- Test: `frontend/src/components/routines/DuplicateRoutineModal.test.jsx`

**Interfaces:**
- Consumes: `POST /routines/{id}/duplicate` de Task 2.
- Produces: `<DuplicateRoutineModal routine={{id, name}} destino="cliente"|"mia" title={string} onClose={fn} />`. Al confirmar, navega a `/routines/<id nuevo>` y llama `onClose`.

- [ ] **Step 1: Write the failing test**

`frontend/src/components/routines/DuplicateRoutineModal.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DuplicateRoutineModal from './DuplicateRoutineModal'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: { post: vi.fn() },
}))

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

const RUTINA = { id: 7, name: 'Pierna' }

function montar(props = {}) {
  const onClose = vi.fn()
  render(
    <DuplicateRoutineModal routine={RUTINA} destino="cliente"
      title="Duplicar para clientes" onClose={onClose} {...props} />,
  )
  return { onClose }
}

describe('DuplicateRoutineModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prellena el nombre con "(copia)"', () => {
    montar()
    expect(screen.getByRole('textbox')).toHaveValue('Pierna (copia)')
  })

  it('manda destino y nombre, y lleva a la copia', async () => {
    api.post.mockResolvedValue({ data: { id: 42 } })
    const { onClose } = montar()
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Para Ana')
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/routines/42'))
    expect(api.post).toHaveBeenCalledWith('/routines/7/duplicate',
      { destino: 'cliente', name: 'Para Ana' })
    expect(onClose).toHaveBeenCalled()
  })

  it('nombre vacio manda null', async () => {
    api.post.mockResolvedValue({ data: { id: 43 } })
    montar({ destino: 'mia' })
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/routines/7/duplicate',
      { destino: 'mia', name: null }))
  })

  it('muestra el error del servidor y no navega', async () => {
    api.post.mockRejectedValue({ response: { data: { detail: 'Necesitas ser coach' } } })
    const { onClose } = montar()
    await userEvent.click(screen.getByRole('button', { name: /duplicar/i }))
    expect(await screen.findByText('Necesitas ser coach')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.js src/components/routines/DuplicateRoutineModal.test.jsx`
Expected: FAIL con `Failed to resolve import "./DuplicateRoutineModal"`

- [ ] **Step 3: Write minimal implementation**

`frontend/src/components/routines/DuplicateRoutineModal.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

import api from '../../services/api'

const NAME_MAX = 100

// Copia una rutina propia. destino="cliente" la deja en el panel de coach;
// destino="mia", en las rutinas propias. Al terminar abre la copia.
export default function DuplicateRoutineModal({ routine, destino, title, onClose }) {
  const navigate = useNavigate()
  const [name, setName] = useState(`${routine.name} (copia)`.slice(0, NAME_MAX))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const duplicar = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post(`/routines/${routine.id}/duplicate`, {
        destino,
        name: name.trim() || null,
      })
      onClose()
      navigate(`/routines/${data.id}`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'No pudimos duplicar la rutina')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold truncate">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <label className="block text-xs text-gray-400 mt-4 mb-1">Nombre de la copia</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          className="input w-full"
          autoFocus
        />

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm py-2">
            Cancelar
          </button>
          <button onClick={duplicar} disabled={saving} className="btn-primary flex-1 text-sm py-2">
            {saving ? 'Duplicando...' : 'Duplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config vitest.config.js src/components/routines/DuplicateRoutineModal.test.jsx`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/routines/DuplicateRoutineModal.jsx frontend/src/components/routines/DuplicateRoutineModal.test.jsx
git commit -m "feat: modal para duplicar una rutina"
```

---

### Task 4: Botones en el panel de coach y en el detalle de rutina

**Files:**
- Modify: `frontend/src/components/coach/CoachRoutinesTab.jsx`
- Modify: `frontend/src/pages/RoutineDetail.jsx`

**Interfaces:**
- Consumes: `DuplicateRoutineModal` de Task 3; `useAuth()` de `contexts/AuthContext.jsx` (expone `user` con `is_coach` e `is_admin`).

- [ ] **Step 1: Panel de coach**

En `CoachRoutinesTab.jsx`:

Imports:

```jsx
import { Plus, Zap, Users, Share2, Calendar, Dumbbell, Copy, UserPlus } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'
import ShareLinkModal from './ShareLinkModal'
import DuplicateRoutineModal from '../routines/DuplicateRoutineModal'
```

Estado, debajo de `const [sharing, setSharing] = useState(null)`:

```jsx
  const [duplicando, setDuplicando] = useState(null) // { routine, destino, title }
```

Dentro de cada tarjeta, despues del `<div className="flex items-start justify-between gap-3">...</div>` que cierra con el boton Compartir, agregar:

```jsx
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setDuplicando({ routine: r, destino: 'cliente', title: 'Duplicar para clientes' })}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-3"
              >
                <Copy size={13} /> Duplicar
              </button>
              <button
                onClick={() => setDuplicando({ routine: r, destino: 'mia', title: 'Copiar a mis rutinas' })}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-3"
              >
                <UserPlus size={13} /> A mis rutinas
              </button>
            </div>
```

Y junto al render de `ShareLinkModal`:

```jsx
      {duplicando && (
        <DuplicateRoutineModal
          routine={duplicando.routine}
          destino={duplicando.destino}
          title={duplicando.title}
          onClose={() => setDuplicando(null)}
        />
      )}
```

- [ ] **Step 2: Detalle de rutina**

En `RoutineDetail.jsx`:

Imports: agregar `Share2` a la lista de `lucide-react` y

```jsx
import { useAuth } from '../contexts/AuthContext'
import DuplicateRoutineModal from '../components/routines/DuplicateRoutineModal'
```

Dentro del componente, debajo de `const readOnly = !!routine?.read_only`:

```jsx
  const { user } = useAuth()
  // Solo una rutina personal propia se publica para clientes; las de
  // clientes ya viven en el panel de coach, donde se duplican.
  const puedeCompartirClientes = !!(user?.is_coach || user?.is_admin)
    && !readOnly && routine && !routine.is_template
  const [showShareClientes, setShowShareClientes] = useState(false)
```

En el bloque `{!readOnly && (<div className="flex gap-2">...` agregar un tercer boton despues de "Nueva":

```jsx
              {puedeCompartirClientes && (
                <button onClick={() => setShowShareClientes(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-500 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-xl transition-colors">
                  <Share2 size={14} /> Compartir con clientes
                </button>
              )}
```

Y junto al modal de horario (`{showSchedule && (...)}`):

```jsx
      {showShareClientes && (
        <DuplicateRoutineModal
          routine={routine}
          destino="cliente"
          title="Compartir con clientes"
          onClose={() => setShowShareClientes(false)}
        />
      )}
```

La carga de la rutina en `RoutineDetail` ya depende de `[id]`, asi que navegar de la original a la copia recarga la pantalla sin cambios extra.

- [ ] **Step 3: Pruebas y build**

Run: `npm test`
Expected: todo en verde.

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/coach/CoachRoutinesTab.jsx frontend/src/pages/RoutineDetail.jsx
git commit -m "feat: botones para duplicar rutinas en coach y detalle"
```
