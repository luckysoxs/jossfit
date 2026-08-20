# Rutinas de coach compartidas por enlace — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un coach crea rutinas, genera un enlace, y quien lo abre entra con su cuenta (registrándose si hace falta) para entrenar una rutina que sigue viva y editable por el coach.

**Architecture:** Capa nueva encima de lo existente. Cuatro tablas (`routine_share_links`, `routine_assignments`, `share_link_visits`, `routine_change_requests`) y dos columnas (`users.is_coach`, `routines.is_template`). Dos routers nuevos: `/coach` (protegido) y `/share` (público). Un helper de acceso, `routine_access.py`, media toda la lectura. La escritura de rutinas **no se toca**: sus filtros por `Routine.user_id` ya dejan al cliente en solo lectura.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0 (estilo `Mapped[...]`), PostgreSQL, JWT con python-jose, React 18 + Vite, TailwindCSS, axios, react-router-dom, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-20-rutinas-coach-enlace-compartido-design.md`

## Global Constraints

- **Migraciones sin Alembic.** Todo cambio de esquema se agrega a la lista `migrations` en `app/main.py::run_migrations()` con `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`. Es el patrón del proyecto; Alembic está instalado pero sin usar.
- **SQLAlchemy estilo 2.0**: `Mapped[tipo]` + `mapped_column(...)`, como en `app/models/routine.py`.
- **Pydantic v2**: `model_config = {"from_attributes": True}`, nunca `class Config`.
- **Mensajes de error visibles al usuario en español.** Los nombres de código en inglés, igual que el resto del proyecto.
- **Fechas con `today_mx()` / `now_mx()`** de `app/utils/timezone.py`. Nunca `date.today()` ni `datetime.utcnow()` para lógica de negocio.
- **Notificaciones envueltas en `try/except`** que no bloquean la operación principal, como en `app/routers/suggestions.py:69-79`.
- **Los endpoints de escritura de `app/routers/routines.py` NO se modifican.** Su filtro `Routine.user_id == user.id` es la garantía de solo lectura del cliente.
- **Frontend**: componentes funcionales, `api` de `src/services/api.js`, clases utilitarias existentes (`card`, `btn-primary`, `btn-secondary`, `input`, `label`), íconos de `lucide-react`, soporte claro/oscuro con `dark:`.
- **Tokens de enlace**: `secrets.token_urlsafe(16)`.
- **Commits en español**, prefijo convencional (`feat:`, `fix:`, `test:`, `refactor:`).

## Estructura de archivos

**Backend — se crean**

| Archivo | Responsabilidad |
|---|---|
| `app/models/coach.py` | Los 4 modelos del dominio de compartir. Cambian juntos, viven juntos |
| `app/models/routine_progress.py` | `RoutineProgress` — hoy es la única tabla sin modelo |
| `app/schemas/coach.py` | Pydantic de `/coach` y `/share` |
| `app/services/routine_access.py` | Única fuente de verdad de quién puede leer una rutina |
| `app/services/coach_notifications.py` | Los 4 avisos. Usado desde `coach.py`, `share.py` y `routines.py` |
| `app/routers/coach.py` | Panel de coach |
| `app/routers/share.py` | Vista previa pública y reclamo |
| `tests/conftest.py` | Fixtures: SQLite en memoria, cliente, usuarios |
| `tests/test_share_links.py` | Enlaces: revocado, expirado, lleno, idempotencia |
| `tests/test_routine_access.py` | Aislamiento de lectura y escritura |
| `tests/test_coach_panel.py` | Aislamiento entre coaches, adherencia |

**Backend — se modifican**

`app/main.py` · `app/models/__init__.py` · `app/models/user.py` · `app/models/routine.py` · `app/schemas/user.py` · `app/schemas/admin.py` · `app/schemas/routine.py` · `app/auth/security.py` · `app/routers/routines.py` · `app/routers/workouts.py` · `app/routers/ai.py` · `app/routers/admin.py` · `requirements.txt`

**Frontend — se crean**

| Archivo | Responsabilidad |
|---|---|
| `src/services/pendingShare.js` | Token pendiente en `sessionStorage` |
| `src/pages/SharedRoutine.jsx` | Pantalla pública `/r/:token` |
| `src/pages/Coach.jsx` | Contenedor del panel con 3 pestañas |
| `src/components/coach/CoachRoutinesTab.jsx` | Rutinas de cliente |
| `src/components/coach/ShareLinkModal.jsx` | Crear, listar y revocar enlaces |
| `src/components/coach/CoachClientsTab.jsx` | Adherencia |
| `src/components/coach/CoachRequestsTab.jsx` | Solicitudes |
| `src/components/routines/ChangeRequestModal.jsx` | El cliente pide un cambio |

**Frontend — se modifican**

`src/App.jsx` · `src/pages/Login.jsx` · `src/pages/Register.jsx` · `src/pages/Routines.jsx` · `src/pages/RoutineDetail.jsx` · `src/pages/RoutineDayDetail.jsx` · `src/pages/Admin.jsx` · `src/components/layout/TopBar.jsx`

---

### Task 1: Infraestructura de pruebas

El backend no tiene pruebas. Antes de escribir la primera línea de esta capa hay que poder ejecutarlas, porque es la primera que expone un endpoint público y la primera donde un usuario toca datos de otro.

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_smoke.py`
- Create: `backend/pytest.ini`

**Interfaces:**
- Consumes: nada
- Produces: fixtures `db_session`, `client`, y la función `make_user(client, email, **kwargs) -> dict` que devuelve `{"token": str, "user": dict, "headers": dict}`. Todas las tareas siguientes las usan.

- [ ] **Step 1: Agregar dependencias de prueba**

En `backend/requirements.txt`, al final:

```
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 2: Crear `backend/pytest.ini`**

```ini
[pytest]
testpaths = tests
python_files = test_*.py
filterwarnings =
    ignore::DeprecationWarning
```

- [ ] **Step 3: Crear `backend/tests/__init__.py`**

Archivo vacío.

- [ ] **Step 4: Crear `backend/tests/conftest.py`**

SQLite en memoria con `StaticPool` para que todas las conexiones compartan la misma base. Las pruebas **no** ejecutan el `lifespan` de la app, así que `run_migrations()` y `seed_all()` no corren: el esquema sale de `Base.metadata.create_all()`.

```python
"""Fixtures de prueba: SQLite en memoria, cliente HTTP y usuarios."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import *  # noqa: F401,F403 — registra todos los modelos
from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Sin context manager: no dispara lifespan, no corre seed ni migraciones.
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(client, email, **kwargs):
    """Registra un usuario y devuelve token, datos y headers listos para usar."""
    payload = {
        "email": email,
        "password": "Password123",
        "name": kwargs.get("name", email.split("@")[0]),
        "age": kwargs.get("age", 30),
        "sex": kwargs.get("sex", "male"),
        "height_cm": kwargs.get("height_cm", 175.0),
        "weight_kg": kwargs.get("weight_kg", 75.0),
        "training_level": kwargs.get("training_level", "intermediate"),
        "accepted_terms": True,
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    return {
        "token": data["access_token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture
def seed_exercises(db_session):
    """Un puñado de ejercicios para poder armar rutinas."""
    rows = [
        Exercise(name="Bench Press", name_es="Press de banca",
                 muscle_group=MuscleGroup.CHEST, category=ExerciseCategory.COMPOUND),
        Exercise(name="Squat", name_es="Sentadilla",
                 muscle_group=MuscleGroup.QUADRICEPS, category=ExerciseCategory.COMPOUND),
        Exercise(name="Bicep Curl", name_es="Curl de bíceps",
                 muscle_group=MuscleGroup.BICEPS, category=ExerciseCategory.ISOLATION),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return [r.id for r in rows]
```

- [ ] **Step 5: Crear la prueba de humo `backend/tests/test_smoke.py`**

```python
from tests.conftest import make_user


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_register_and_me(client):
    u = make_user(client, "smoke@test.com", name="Smoke")
    res = client.get("/auth/me", headers=u["headers"])
    assert res.status_code == 200
    assert res.json()["email"] == "smoke@test.com"
    assert res.json()["name"] == "Smoke"


def test_exercises_fixture_loads(client, seed_exercises):
    assert len(seed_exercises) == 3
```

- [ ] **Step 6: Instalar y ejecutar**

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

Esperado: los 3 tests en PASS.

Si `test_register_and_me` falla con un error de push, revisar que `send_push_to_admins` esté dentro del `try/except` en `app/routers/auth.py:40-48` — ya lo está, pero es el punto que primero se rompe sin VAPID configurado.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/
git commit -m "test: infraestructura de pruebas con pytest y SQLite en memoria"
```

---

### Task 2: `RoutineProgress` como modelo

`routine_progress` es la única tabla del proyecto sin modelo SQLAlchemy: se crea con SQL crudo en `run_migrations()` y se lee y escribe con `text()` en `app/routers/workouts.py:191-229`. Eso la vuelve invisible para `Base.metadata.create_all()`, así que no existe en las pruebas — y la Task 5 necesita probar precisamente esos endpoints.

Se promueve a modelo. Es el archivo que vamos a tocar de todos modos para agregar la validación de acceso.

**Files:**
- Create: `backend/app/models/routine_progress.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/routers/workouts.py:191-229`
- Create: `backend/tests/test_routine_progress.py`

**Interfaces:**
- Consumes: fixtures de Task 1
- Produces: `RoutineProgress` con campos `id, user_id, routine_id, date, checked_data, updated_at`. La Task 5 le agrega la validación de acceso.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_routine_progress.py`:

```python
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


def test_progreso_separado_entre_usuarios(client):
    """Dos clientes con la misma rutina no se pisan el progreso."""
    a = make_user(client, "pa@test.com")
    b = make_user(client, "pb@test.com")
    rid = _make_routine(client, a["headers"])
    client.put(f"/workouts/progress/{rid}", headers=a["headers"], json={"1": True})
    client.put(f"/workouts/progress/{rid}", headers=b["headers"], json={"9": True})
    assert client.get(f"/workouts/progress/{rid}", headers=a["headers"]).json() == {"1": True}
    assert client.get(f"/workouts/progress/{rid}", headers=b["headers"]).json() == {"9": True}
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_routine_progress.py -v
```

Esperado: FAIL. `test_progreso_guarda_y_lee` truena con `OperationalError: no such table: routine_progress` o con error de sintaxis en `cast(:data as jsonb)`, porque el SQL crudo es de PostgreSQL.

- [ ] **Step 3: Crear el modelo**

`backend/app/models/routine_progress.py`:

```python
from datetime import datetime, date as date_type

from sqlalchemy import Integer, ForeignKey, DateTime, Date, JSON, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# JSONB en PostgreSQL (coincide con la tabla que ya existe en producción),
# JSON genérico en SQLite para que las pruebas corran sin Postgres.
JSONType = JSON().with_variant(JSONB, "postgresql")


class RoutineProgress(Base):
    """Ejercicios marcados hoy, por usuario y rutina. Sincroniza entre dispositivos."""

    __tablename__ = "routine_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "routine_id", "date", name="uq_routine_progress"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    date: Mapped[date_type] = mapped_column(Date)
    checked_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 4: Registrar el modelo**

En `backend/app/models/__init__.py`, después de la línea de `routine`:

```python
from app.models.routine_progress import RoutineProgress
```

Y agregar `"RoutineProgress",` a `__all__`.

- [ ] **Step 5: Reescribir los endpoints con el ORM**

En `backend/app/routers/workouts.py`, reemplazar por completo las dos funciones `get_routine_progress` y `save_routine_progress` (líneas 191-229) por:

```python
@router.get("/progress/{routine_id}")
def get_routine_progress(
    routine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estado marcado de hoy para una rutina (sincronizado entre dispositivos)."""
    row = (
        db.query(RoutineProgress)
        .filter(
            RoutineProgress.user_id == user.id,
            RoutineProgress.routine_id == routine_id,
            RoutineProgress.date == today_mx(),
        )
        .first()
    )
    return row.checked_data if row else {}


@router.put("/progress/{routine_id}")
def save_routine_progress(
    routine_id: int,
    checked_data: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Guarda el estado marcado (se sincroniza entre dispositivos)."""
    today = today_mx()
    row = (
        db.query(RoutineProgress)
        .filter(
            RoutineProgress.user_id == user.id,
            RoutineProgress.routine_id == routine_id,
            RoutineProgress.date == today,
        )
        .first()
    )
    if row:
        row.checked_data = checked_data
    else:
        db.add(RoutineProgress(
            user_id=user.id,
            routine_id=routine_id,
            date=today,
            checked_data=checked_data,
        ))
    db.commit()
    return {"ok": True}
```

Agregar el import arriba del archivo, junto a los demás modelos:

```python
from app.models.routine_progress import RoutineProgress
```

Verificar que `today_mx` ya esté importado en el archivo — lo está, se usa en otros endpoints.

- [ ] **Step 6: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_routine_progress.py -v
```

Esperado: los 4 en PASS.

- [ ] **Step 7: Verificar que no se rompió nada**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

La tabla de producción no cambia: el `CREATE TABLE IF NOT EXISTS routine_progress` en `run_migrations()` se queda tal cual y el modelo coincide columna por columna. No hay migración de datos.

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/routine_progress.py backend/app/models/__init__.py backend/app/routers/workouts.py backend/tests/test_routine_progress.py
git commit -m "refactor: routine_progress como modelo SQLAlchemy en vez de SQL crudo"
```

---

### Task 3: Modelos y migraciones de la capa de coach

**Files:**
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/models/routine.py`
- Create: `backend/app/models/coach.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py` (lista `migrations`)
- Modify: `backend/app/schemas/user.py`
- Modify: `backend/app/schemas/routine.py`
- Create: `backend/tests/test_coach_models.py`

**Interfaces:**
- Consumes: fixtures de Task 1
- Produces:
  - `User.is_coach: bool`
  - `Routine.is_template: bool`
  - `RoutineShareLink(id, token, routine_id, coach_id, kind, label, max_claims, expires_at, revoked, created_at)`
  - `RoutineAssignment(id, routine_id, client_id, coach_id, link_id, status, assigned_at)`
  - `ShareLinkVisit(id, link_id, user_id, claimed, visited_at)`
  - `RoutineChangeRequest(id, assignment_id, client_id, routine_exercise_id, content, status, coach_reply, created_at)`
  - `UserResponse.is_coach: bool`
  - `RoutineResponse.is_template: bool`, `.read_only: bool`, `.assigned_by: str | None`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_coach_models.py`:

```python
from tests.conftest import make_user


def test_usuario_nuevo_no_es_coach(client):
    u = make_user(client, "nc@test.com")
    assert u["user"]["is_coach"] is False


def test_rutina_nueva_no_es_plantilla(client):
    u = make_user(client, "nt@test.com")
    res = client.post("/routines", headers=u["headers"], json={
        "name": "Mía", "split_type": "full_body",
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
    import pytest
    from sqlalchemy.exc import IntegrityError
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
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_coach_models.py -v
```

Esperado: FAIL. `test_usuario_nuevo_no_es_coach` con `KeyError: 'is_coach'`, y `test_tablas_de_coach_existen` con `ModuleNotFoundError: No module named 'app.models.coach'`.

- [ ] **Step 3: Agregar `is_coach` al modelo `User`**

En `backend/app/models/user.py`, justo después de la línea de `is_admin`:

```python
    is_coach: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 4: Agregar `is_template` al modelo `Routine`**

En `backend/app/models/routine.py`, en la clase `Routine`, después de `rest_weekdays`:

```python
    # True = rutina hecha para clientes. No aparece en la lista de entrenamiento
    # propia del coach; vive en el panel de coach.
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
```

Y agregar `Boolean` al import de `sqlalchemy` en ese archivo:

```python
from sqlalchemy import String, Integer, ForeignKey, DateTime, JSON, func, Text, VARCHAR, Boolean
```

- [ ] **Step 5: Crear `backend/app/models/coach.py`**

```python
"""Modelos para compartir rutinas de coach a clientes.

Los cuatro cambian juntos y describen un solo dominio: el coach genera un
enlace, alguien lo abre (visita), lo reclama (asignación), y desde ahí puede
pedir cambios.
"""

from datetime import datetime

from sqlalchemy import (
    String, Integer, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RoutineShareLink(Base):
    """Un enlace compartible. `kind` distingue enlace personal de plantilla."""

    __tablename__ = "routine_share_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"), index=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # 'personal' | 'plantilla'
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    max_claims: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = ilimitado
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # None = nunca
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    routine = relationship("Routine")
    coach = relationship("User", foreign_keys=[coach_id])


class RoutineAssignment(Base):
    """Un cliente con acceso a una rutina del coach.

    El UNIQUE(routine_id, client_id) es lo que hace idempotente el reclamo:
    refrescar la página no crea otra asignación ni consume otro cupo.
    """

    __tablename__ = "routine_assignments"
    __table_args__ = (
        UniqueConstraint("routine_id", "client_id", name="uq_routine_assignment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    link_id: Mapped[int | None] = mapped_column(
        ForeignKey("routine_share_links.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(10), default="active")  # 'active' | 'revoked'
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    routine = relationship("Routine")
    client = relationship("User", foreign_keys=[client_id])
    coach = relationship("User", foreign_keys=[coach_id])


class ShareLinkVisit(Base):
    """Quién abrió un enlace. `user_id` es NULL si aún no había sesión."""

    __tablename__ = "share_link_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    link_id: Mapped[int] = mapped_column(
        ForeignKey("routine_share_links.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    visited_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RoutineChangeRequest(Base):
    """El cliente pide un cambio; el coach acepta o rechaza con respuesta."""

    __tablename__ = "routine_change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("routine_assignments.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("routine_exercises.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), default="pendiente", index=True)
    coach_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    assignment = relationship("RoutineAssignment")
    client = relationship("User")
```

- [ ] **Step 6: Registrar los modelos**

En `backend/app/models/__init__.py`, agregar el import:

```python
from app.models.coach import (
    RoutineShareLink, RoutineAssignment, ShareLinkVisit, RoutineChangeRequest,
)
```

Y a `__all__`:

```python
    "RoutineShareLink", "RoutineAssignment", "ShareLinkVisit", "RoutineChangeRequest",
```

- [ ] **Step 7: Agregar las migraciones de producción**

En `backend/app/main.py`, dentro de la lista `migrations` de `run_migrations()`, al final (justo antes del `DELETE FROM notifications` que la cierra):

```python
        # ─── Rutinas de coach compartidas por enlace ───
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_coach BOOLEAN DEFAULT FALSE",
        "ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE",
        """CREATE TABLE IF NOT EXISTS routine_share_links (
            id SERIAL PRIMARY KEY,
            token VARCHAR(32) UNIQUE NOT NULL,
            routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
            coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            kind VARCHAR(10) NOT NULL,
            label VARCHAR(100),
            max_claims INTEGER,
            expires_at TIMESTAMP,
            revoked BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_rsl_token ON routine_share_links(token)",
        "CREATE INDEX IF NOT EXISTS idx_rsl_coach ON routine_share_links(coach_id)",
        "CREATE INDEX IF NOT EXISTS idx_rsl_routine ON routine_share_links(routine_id)",
        """CREATE TABLE IF NOT EXISTS routine_assignments (
            id SERIAL PRIMARY KEY,
            routine_id INTEGER REFERENCES routines(id) ON DELETE CASCADE,
            client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            link_id INTEGER REFERENCES routine_share_links(id) ON DELETE SET NULL,
            status VARCHAR(10) DEFAULT 'active',
            assigned_at TIMESTAMP DEFAULT NOW(),
            CONSTRAINT uq_routine_assignment UNIQUE (routine_id, client_id)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_ra_client ON routine_assignments(client_id)",
        "CREATE INDEX IF NOT EXISTS idx_ra_coach ON routine_assignments(coach_id)",
        """CREATE TABLE IF NOT EXISTS share_link_visits (
            id SERIAL PRIMARY KEY,
            link_id INTEGER REFERENCES routine_share_links(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            claimed BOOLEAN DEFAULT FALSE,
            visited_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_slv_link ON share_link_visits(link_id)",
        """CREATE TABLE IF NOT EXISTS routine_change_requests (
            id SERIAL PRIMARY KEY,
            assignment_id INTEGER REFERENCES routine_assignments(id) ON DELETE CASCADE,
            client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            routine_exercise_id INTEGER REFERENCES routine_exercises(id) ON DELETE SET NULL,
            content TEXT NOT NULL,
            status VARCHAR(15) DEFAULT 'pendiente',
            coach_reply TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_rcr_assignment ON routine_change_requests(assignment_id)",
        "CREATE INDEX IF NOT EXISTS idx_rcr_status ON routine_change_requests(status)",
```

- [ ] **Step 8: Exponer los campos nuevos en los schemas**

En `backend/app/schemas/user.py`, en `UserResponse`, justo después de `is_admin`:

```python
    is_coach: bool = False
```

En `backend/app/schemas/routine.py`, en `RoutineResponse`, después de `rest_weekdays`:

```python
    is_template: bool = False
    # Se llenan al vuelo cuando la rutina viene de un coach; no son columnas.
    read_only: bool = False
    assigned_by: str | None = None
```

- [ ] **Step 9: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_coach_models.py -v
```

Esperado: los 4 en PASS.

- [ ] **Step 10: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/app/models/ backend/app/schemas/ backend/app/main.py backend/tests/test_coach_models.py
git commit -m "feat: modelos y migraciones de rutinas de coach compartidas"
```

---

### Task 4: Dependencias de autenticación `get_coach_user` y `get_optional_user`

Dos dependencias nuevas. `get_coach_user` protege el panel. `get_optional_user` es la que permite que `GET /share/{token}` funcione con y sin sesión — sin ella, un token vencido guardado en el celular del cliente haría fallar la vista previa pública.

**Files:**
- Modify: `backend/app/auth/security.py`
- Create: `backend/tests/test_auth_deps.py`

**Interfaces:**
- Consumes: `User.is_coach` (Task 3)
- Produces:
  - `get_coach_user(user: User = Depends(get_current_user)) -> User` — 403 si no es coach ni admin
  - `get_optional_user(authorization: str | None, db: Session) -> User | None` — nunca lanza

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_auth_deps.py`:

```python
from tests.conftest import make_user
from app.models.user import User


def test_no_coach_recibe_403(client):
    u = make_user(client, "nocoach@test.com")
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 403
    assert "coach" in res.json()["detail"].lower()


def test_coach_entra(client, db_session):
    u = make_user(client, "coach@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200


def test_admin_tambien_entra(client, db_session):
    """Un admin es coach implícito: no hay que darle los dos flags."""
    u = make_user(client, "admin@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200


def test_sin_token_recibe_401(client):
    res = client.get("/coach/routines")
    assert res.status_code == 401
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_auth_deps.py -v
```

Esperado: FAIL con 404 en todos — `/coach/routines` no existe todavía. El router llega en la Task 7; estas pruebas quedan rojas hasta entonces, lo cual es correcto: describen el contrato que esa tarea debe cumplir.

- [ ] **Step 3: Agregar las dependencias**

En `backend/app/auth/security.py`, al final del archivo:

```python
def get_coach_user(
    user: User = Depends(get_current_user),
) -> User:
    """Permite el paso a coaches y a admins. Un admin es coach implícito."""
    if not (user.is_coach or user.is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Necesitas ser coach para entrar aqui",
        )
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    """Devuelve el usuario si hay un token valido, o None.

    Nunca lanza: la vista previa publica de un enlace tiene que funcionar sin
    sesion y tambien con un token vencido guardado en el navegador.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None
        return db.query(User).filter(User.id == int(sub)).first()
    except (JWTError, ValueError):
        return None
```

Agregar `Header` al import de fastapi en la primera línea del archivo:

```python
from fastapi import Depends, HTTPException, status, Header
```

- [ ] **Step 4: Commit**

Las pruebas quedan rojas hasta la Task 7. Commitear el código de las dependencias ahora; las pruebas van junto con el router.

```bash
git add backend/app/auth/security.py
git commit -m "feat: dependencias get_coach_user y get_optional_user"
```

---

### Task 5: Helper de acceso y cierre del hueco de progreso

Hoy `GET/PUT /workouts/progress/{routine_id}` **no verifica nada**: cualquier usuario puede leer y escribir progreso contra cualquier `routine_id`. Es un hueco preexistente que esta capa vuelve alcanzable de forma natural, así que se cierra aquí.

**Files:**
- Create: `backend/app/services/routine_access.py`
- Modify: `backend/app/routers/workouts.py` (los dos endpoints de progreso)
- Create: `backend/tests/test_routine_access.py`

**Interfaces:**
- Consumes: `RoutineAssignment` (Task 3), `RoutineProgress` (Task 2)
- Produces:
  - `get_assignment(db, user_id: int, routine_id: int) -> RoutineAssignment | None` — solo activas
  - `has_routine_access(db, user_id: int, routine_id: int) -> bool`
  - `get_readable_routine(db, user: User, routine_id: int) -> Routine` — 404 si no
  - `assert_routine_access(db, user_id: int, routine_id: int) -> None` — 403 si no
  - `get_assigned_routine_ids(db, user_id: int) -> list[int]`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_routine_access.py`:

```python
import pytest
from tests.conftest import make_user
from app.models.coach import RoutineAssignment


def _crear_rutina(client, headers, name="Rutina"):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _asignar(db_session, routine_id, client_id, coach_id, status="active"):
    a = RoutineAssignment(
        routine_id=routine_id, client_id=client_id,
        coach_id=coach_id, status=status,
    )
    db_session.add(a)
    db_session.commit()
    return a.id


def test_extrano_no_lee_la_rutina(client):
    dueno = make_user(client, "d1@test.com")
    extrano = make_user(client, "e1@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.get(f"/routines/{rid}", headers=extrano["headers"])
    assert res.status_code == 404


def test_extrano_no_escribe_progreso(client):
    """El hueco que se cierra: antes esto devolvia 200."""
    dueno = make_user(client, "d2@test.com")
    extrano = make_user(client, "e2@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.put(f"/workouts/progress/{rid}", headers=extrano["headers"], json={"1": True})
    assert res.status_code == 403


def test_extrano_no_lee_progreso(client):
    dueno = make_user(client, "d3@test.com")
    extrano = make_user(client, "e3@test.com")
    rid = _crear_rutina(client, dueno["headers"])
    res = client.get(f"/workouts/progress/{rid}", headers=extrano["headers"])
    assert res.status_code == 403


def test_asignado_si_escribe_progreso(client, db_session):
    coach = make_user(client, "co4@test.com")
    cli = make_user(client, "cl4@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    res = client.put(f"/workouts/progress/{rid}", headers=cli["headers"], json={"7": True})
    assert res.status_code == 200
    res = client.get(f"/workouts/progress/{rid}", headers=cli["headers"])
    assert res.json() == {"7": True}


def test_asignacion_revocada_pierde_acceso(client, db_session):
    coach = make_user(client, "co5@test.com")
    cli = make_user(client, "cl5@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"], status="revoked")

    assert client.get(f"/routines/{rid}", headers=cli["headers"]).status_code == 404
    assert client.put(f"/workouts/progress/{rid}", headers=cli["headers"],
                      json={"1": True}).status_code == 403


@pytest.mark.parametrize("metodo,ruta,cuerpo", [
    ("put",    "/routines/{rid}",          {"name": "Hackeada"}),
    ("delete", "/routines/{rid}",          None),
    ("put",    "/routines/{rid}/schedule", {"rest_weekdays": [6]}),
])
def test_asignado_no_puede_escribir_la_rutina(client, db_session, metodo, ruta, cuerpo):
    """La garantia central del diseno: el filtro por user_id ya deja al cliente fuera."""
    sufijo = f"{metodo}{len(ruta)}"
    coach = make_user(client, f"co6{sufijo}@test.com")
    cli = make_user(client, f"cl6{sufijo}@test.com")
    rid = _crear_rutina(client, coach["headers"])
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    url = ruta.format(rid=rid)
    fn = getattr(client, metodo)
    res = (fn(url, headers=cli["headers"], json=cuerpo) if cuerpo is not None
           else fn(url, headers=cli["headers"]))
    assert res.status_code == 404, f"{metodo.upper()} {url} devolvio {res.status_code}"


def test_asignado_no_borra_ejercicios(client, db_session, seed_exercises):
    """Mismo principio, sobre los endpoints /routines/exercises/*."""
    coach = make_user(client, "co6b@test.com")
    cli = make_user(client, "cl6b@test.com")
    res = client.post("/routines", headers=coach["headers"], json={
        "name": "Con ejercicios", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{
            "day_number": 1, "name": "Dia 1", "focus": "chest",
            "exercises": [{
                "exercise_id": seed_exercises[0], "order": 1,
                "sets": 3, "reps_min": 8, "reps_max": 12, "rest_seconds": 90,
            }],
        }],
    })
    rutina = res.json()
    rid = rutina["id"]
    ex_id = rutina["days"][0]["exercises"][0]["id"]
    day_id = rutina["days"][0]["id"]
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    assert client.delete(f"/routines/exercises/{ex_id}",
                         headers=cli["headers"]).status_code == 404
    assert client.put(f"/routines/exercises/{ex_id}", headers=cli["headers"],
                      json={"sets": 99}).status_code == 404
    assert client.put(f"/routines/exercises/{ex_id}/swap?new_exercise_id={seed_exercises[1]}",
                      headers=cli["headers"]).status_code == 404
    assert client.post(f"/routines/days/{day_id}/regenerate",
                       headers=cli["headers"]).status_code == 404
    assert client.post(f"/routines/days/{day_id}/exercises", headers=cli["headers"], json={
        "exercise_id": seed_exercises[2], "order": 2,
        "sets": 3, "reps_min": 8, "reps_max": 12, "rest_seconds": 60,
    }).status_code == 404


def test_asignado_si_lee_la_rutina(client, db_session):
    coach = make_user(client, "co7@test.com")
    cli = make_user(client, "cl7@test.com")
    rid = _crear_rutina(client, coach["headers"], name="De mi coach")
    _asignar(db_session, rid, cli["user"]["id"], coach["user"]["id"])

    res = client.get(f"/routines/{rid}", headers=cli["headers"])
    assert res.status_code == 200
    assert res.json()["name"] == "De mi coach"
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_routine_access.py -v
```

Esperado: FAIL en `test_extrano_no_escribe_progreso` (devuelve 200 — el hueco), en `test_extrano_no_lee_progreso` (200), y en `test_asignado_si_lee_la_rutina` y `test_asignado_si_escribe_progreso`.

Los `test_asignado_no_puede_escribir_la_rutina` y `test_asignado_no_borra_ejercicios` deben **PASAR desde ya** — es exactamente la garantía que el diseño da por sentada. Si alguno falla, hay un endpoint de escritura sin el filtro por `user_id` y hay que arreglarlo antes de seguir.

- [ ] **Step 3: Crear `backend/app/services/routine_access.py`**

```python
"""Quien puede leer una rutina.

Unica fuente de verdad del acceso de lectura. La escritura no pasa por aqui:
los endpoints de escritura de `routers/routines.py` filtran por
`Routine.user_id == user.id`, asi que un cliente asignado recibe 404 sin
codigo adicional.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.coach import RoutineAssignment
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.user import User


def get_assignment(db: Session, user_id: int, routine_id: int) -> RoutineAssignment | None:
    """La asignacion activa del usuario para esa rutina, si existe."""
    return (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.routine_id == routine_id,
            RoutineAssignment.client_id == user_id,
            RoutineAssignment.status == "active",
        )
        .first()
    )


def get_assigned_routine_ids(db: Session, user_id: int) -> list[int]:
    """Todas las rutinas que el usuario tiene asignadas y activas."""
    rows = (
        db.query(RoutineAssignment.routine_id)
        .filter(
            RoutineAssignment.client_id == user_id,
            RoutineAssignment.status == "active",
        )
        .all()
    )
    return [rid for (rid,) in rows]


def has_routine_access(db: Session, user_id: int, routine_id: int) -> bool:
    """True si es dueno o tiene asignacion activa."""
    owns = (
        db.query(Routine.id)
        .filter(Routine.id == routine_id, Routine.user_id == user_id)
        .first()
    )
    if owns:
        return True
    return get_assignment(db, user_id, routine_id) is not None


def assert_routine_access(db: Session, user_id: int, routine_id: int) -> None:
    """403 si el usuario no tiene nada que hacer con esa rutina."""
    if not has_routine_access(db, user_id, routine_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta rutina",
        )


def get_readable_routine(db: Session, user: User, routine_id: int) -> Routine:
    """La rutina con dias y ejercicios cargados, si el usuario puede verla.

    404 en cualquier otro caso, no 403: no confirmamos que la rutina existe.
    """
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id)
        .options(
            joinedload(Routine.days)
            .joinedload(RoutineDay.exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .first()
    )
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    if routine.user_id == user.id:
        return routine
    if get_assignment(db, user.id, routine_id):
        return routine
    raise HTTPException(status_code=404, detail="Rutina no encontrada")
```

- [ ] **Step 4: Cerrar el hueco en los endpoints de progreso**

En `backend/app/routers/workouts.py`, agregar el import junto a los demás:

```python
from app.services.routine_access import assert_routine_access
```

Y como **primera línea del cuerpo** de `get_routine_progress` y de `save_routine_progress`:

```python
    assert_routine_access(db, user.id, routine_id)
```

- [ ] **Step 5: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_routine_access.py -v
```

Esperado: todas en PASS menos `test_asignado_si_lee_la_rutina`, que necesita el cambio en `GET /routines/{id}` de la Task 6.

- [ ] **Step 6: Verificar que no se rompió el progreso propio**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS salvo `test_asignado_si_lee_la_rutina` y los cuatro de `test_auth_deps.py`, que esperan a las Tasks 6 y 7.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/routine_access.py backend/app/routers/workouts.py backend/tests/test_routine_access.py
git commit -m "feat: helper de acceso a rutinas y validacion en endpoints de progreso"
```

---

### Task 6: `GET /routines` y `GET /routines/{id}` con rutinas asignadas

El cliente debe ver sus rutinas propias **y** las que le asignó su coach, cada una marcada. El coach no debe ver sus rutinas de cliente mezcladas con las suyas.

**Files:**
- Modify: `backend/app/routers/routines.py` (`list_routines`, `get_routine`, helper `_decorate`)
- Create: `backend/tests/test_routines_listing.py`

**Interfaces:**
- Consumes: `get_readable_routine`, `get_assigned_routine_ids` (Task 5); `RoutineResponse.read_only` / `.assigned_by` / `.is_template` (Task 3)
- Produces: `_decorate(db: Session, routine: Routine, user: User) -> RoutineResponse` — helper privado de `routines.py`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_routines_listing.py`:

```python
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
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_routines_listing.py -v
```

Esperado: FAIL en `test_lista_del_coach_excluye_plantillas`, `test_lista_del_cliente_incluye_la_asignada` y `test_detalle_de_asignada_marca_read_only`.

- [ ] **Step 3: Agregar imports y el helper `_decorate`**

En `backend/app/routers/routines.py`, agregar arriba junto a los demás imports:

```python
from sqlalchemy import or_, and_
from app.services.routine_access import get_readable_routine, get_assigned_routine_ids
```

Y al final del archivo, junto a `_load_full_routine`:

```python
def _decorate(db: Session, routine: Routine, user: User) -> RoutineResponse:
    """Convierte a RoutineResponse llenando read_only y assigned_by.

    Los dos describen la relacion usuario-rutina, no son columnas de la tabla.
    """
    resp = RoutineResponse.model_validate(routine)
    if routine.user_id == user.id:
        return resp
    coach = db.query(User).filter(User.id == routine.user_id).first()
    return resp.model_copy(update={
        "read_only": True,
        "assigned_by": coach.name if coach else None,
    })
```

- [ ] **Step 4: Reescribir `list_routines`**

Reemplazar por completo la función `list_routines` (`backend/app/routers/routines.py:69-83`):

```python
@router.get("", response_model=list[RoutineResponse])
def list_routines(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Las rutinas propias mas las que le asigno un coach.

    Las rutinas con is_template=True se excluyen de la lista propia: son las
    que el coach hizo para clientes y viven en su panel de coach.
    """
    assigned_ids = get_assigned_routine_ids(db, user.id)

    condiciones = [
        and_(Routine.user_id == user.id, Routine.is_template == False)  # noqa: E712
    ]
    if assigned_ids:
        condiciones.append(Routine.id.in_(assigned_ids))

    routines = (
        db.query(Routine)
        .filter(or_(*condiciones))
        .options(
            joinedload(Routine.days)
            .joinedload(RoutineDay.exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .order_by(Routine.created_at.desc())
        .all()
    )
    return [_decorate(db, r, user) for r in routines]
```

- [ ] **Step 5: Reescribir `get_routine`**

Reemplazar por completo la función `get_routine`:

```python
@router.get("/{routine_id}", response_model=RoutineResponse)
def get_routine(
    routine_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = get_readable_routine(db, user, routine_id)
    return _decorate(db, routine, user)
```

- [ ] **Step 6: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_routines_listing.py tests/test_routine_access.py -v
```

Esperado: todas en PASS, incluida `test_asignado_si_lee_la_rutina` que quedó pendiente en la Task 5.

- [ ] **Step 7: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS salvo los cuatro de `test_auth_deps.py`, que esperan al router de la Task 7.

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/routines.py backend/tests/test_routines_listing.py
git commit -m "feat: el listado de rutinas incluye las asignadas por coach"
```

---

### Task 7: Router `/coach` — rutinas de cliente y enlaces

**Files:**
- Create: `backend/app/schemas/coach.py`
- Create: `backend/app/routers/coach.py`
- Modify: `backend/app/main.py` (import + `include_router`)
- Modify: `backend/app/routers/ai.py` (soporte `is_template`)
- Create: `backend/tests/test_share_links.py`

**Interfaces:**
- Consumes: `get_coach_user` (Task 4), modelos de Task 3
- Produces:
  - `ShareLinkCreate(kind, label, max_claims, expires_in_days)`
  - `ShareLinkResponse(id, token, path, kind, label, max_claims, expires_at, revoked, visits, claims, remaining, created_at)`
  - `CoachRoutineResponse(id, name, split_type, objective, days_per_week, clients_count, created_at)`
  - `_link_stats(db, link) -> tuple[int, int, int | None]` — visitas, reclamos, cupos restantes
  - `_generate_token(db) -> str`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_share_links.py`:

```python
from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.routine import Routine
from app.models.coach import RoutineShareLink
from app.utils.timezone import now_mx


def hacer_coach(db_session, user_id):
    db_session.query(User).filter(User.id == user_id).update({"is_coach": True})
    db_session.commit()


def crear_rutina_de_cliente(client, headers, name="Full Body"):
    res = client.post("/coach/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_rutina_de_coach_nace_como_plantilla(client, db_session):
    coach = make_user(client, "t1@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])
    r = db_session.query(Routine).filter(Routine.id == rid).first()
    assert r.is_template is True


def test_crear_enlace_personal_fuerza_un_cupo(client, db_session):
    coach = make_user(client, "t2@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "personal", "label": "Rutina de Juan",
        "max_claims": 50, "expires_in_days": None,
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["kind"] == "personal"
    assert body["max_claims"] == 1  # personal siempre es 1, sin importar lo que manden
    assert body["label"] == "Rutina de Juan"
    assert len(body["token"]) >= 20
    assert body["path"] == f"/r/{body['token']}"
    assert body["revoked"] is False
    assert body["visits"] == 0
    assert body["claims"] == 0
    assert body["remaining"] == 1


def test_crear_enlace_plantilla_sin_limite(client, db_session):
    coach = make_user(client, "t3@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None,
        "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 201
    assert res.json()["max_claims"] is None
    assert res.json()["remaining"] is None


def test_expires_in_days_se_convierte_en_fecha(client, db_session):
    coach = make_user(client, "t4@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": 20, "expires_in_days": 30,
    })
    assert res.status_code == 201
    link = db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == res.json()["token"]
    ).first()
    delta = link.expires_at - now_mx().replace(tzinfo=None)
    assert timedelta(days=29) < delta < timedelta(days=31)


def test_no_se_puede_compartir_una_rutina_personal(client, db_session):
    """Solo se comparten rutinas marcadas para clientes."""
    coach = make_user(client, "t5@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    res = client.post("/routines", headers=coach["headers"], json={
        "name": "La mia", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    rid = res.json()["id"]

    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 400
    assert "cliente" in res.json()["detail"].lower()


def test_coach_no_comparte_rutina_de_otro_coach(client, db_session):
    a = make_user(client, "t6a@test.com")
    b = make_user(client, "t6b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    rid = crear_rutina_de_cliente(client, a["headers"])

    res = client.post(f"/coach/routines/{rid}/links", headers=b["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    assert res.status_code == 404


def test_listar_rutinas_solo_las_propias(client, db_session):
    a = make_user(client, "t7a@test.com")
    b = make_user(client, "t7b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    crear_rutina_de_cliente(client, a["headers"], name="De A")
    crear_rutina_de_cliente(client, b["headers"], name="De B")

    nombres_a = [r["name"] for r in client.get("/coach/routines", headers=a["headers"]).json()]
    assert nombres_a == ["De A"]
    nombres_b = [r["name"] for r in client.get("/coach/routines", headers=b["headers"]).json()]
    assert nombres_b == ["De B"]


def test_revocar_enlace(client, db_session):
    coach = make_user(client, "t8@test.com")
    hacer_coach(db_session, coach["user"]["id"])
    rid = crear_rutina_de_cliente(client, coach["headers"])
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    link_id = res.json()["id"]

    assert client.delete(f"/coach/links/{link_id}", headers=coach["headers"]).status_code == 200
    enlaces = client.get(f"/coach/routines/{rid}/links", headers=coach["headers"]).json()
    assert enlaces[0]["revoked"] is True


def test_no_se_revoca_el_enlace_de_otro_coach(client, db_session):
    a = make_user(client, "t9a@test.com")
    b = make_user(client, "t9b@test.com")
    hacer_coach(db_session, a["user"]["id"])
    hacer_coach(db_session, b["user"]["id"])
    rid = crear_rutina_de_cliente(client, a["headers"])
    res = client.post(f"/coach/routines/{rid}/links", headers=a["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    link_id = res.json()["id"]

    assert client.delete(f"/coach/links/{link_id}", headers=b["headers"]).status_code == 404
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_share_links.py -v
```

Esperado: FAIL, 404 en todos — el router no existe.

- [ ] **Step 3: Crear `backend/app/schemas/coach.py`**

```python
from datetime import datetime

from pydantic import BaseModel


# ─── Enlaces ────────────────────────────────────────────────────

class ShareLinkCreate(BaseModel):
    kind: str                          # 'personal' | 'plantilla'
    label: str | None = None
    max_claims: int | None = None      # None = ilimitado; en 'personal' se fuerza a 1
    expires_in_days: int | None = None  # None = nunca expira


class ShareLinkResponse(BaseModel):
    id: int
    token: str
    path: str                          # "/r/<token>" — el front le antepone su origen
    kind: str
    label: str | None
    max_claims: int | None
    expires_at: datetime | None
    revoked: bool
    visits: int
    claims: int
    remaining: int | None              # None si es ilimitado
    created_at: datetime


# ─── Rutinas de cliente ─────────────────────────────────────────

class CoachRoutineResponse(BaseModel):
    id: int
    name: str
    split_type: str
    objective: str | None
    days_per_week: int
    clients_count: int
    created_at: datetime


# ─── Clientes ───────────────────────────────────────────────────

class CoachClientResponse(BaseModel):
    assignment_id: int
    user_id: int
    name: str
    email: str
    routine_id: int
    routine_name: str
    last_workout_date: str | None       # ISO o None si nunca entreno
    workouts_this_week: int
    days_per_week: int
    pending_requests: int


# ─── Solicitudes de cambio ──────────────────────────────────────

class ChangeRequestCreate(BaseModel):
    routine_exercise_id: int | None = None
    content: str


class ChangeRequestResponse(BaseModel):
    id: int
    client_id: int
    client_name: str
    routine_id: int
    routine_name: str
    exercise_name: str | None
    content: str
    status: str
    coach_reply: str | None
    created_at: datetime


class ChangeRequestUpdate(BaseModel):
    status: str                        # 'aceptada' | 'rechazada'
    coach_reply: str | None = None
```

- [ ] **Step 4: Crear `backend/app/routers/coach.py`**

Sólo la parte de rutinas y enlaces. Clientes y solicitudes llegan en las Tasks 9 y 10.

```python
"""Panel de coach: rutinas para clientes, enlaces, adherencia y solicitudes.

Todas las consultas filtran por coach_id: un coach no ve nada de otro coach.
"""

import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.auth.security import get_coach_user
from app.database import get_db
from app.models.coach import RoutineAssignment, RoutineShareLink, ShareLinkVisit
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.user import User
from app.schemas.coach import (
    CoachRoutineResponse,
    ShareLinkCreate,
    ShareLinkResponse,
)
from app.schemas.routine import RoutineCreate, RoutineResponse
from app.utils.timezone import now_mx

router = APIRouter(prefix="/coach", tags=["Coach"])

VALID_KINDS = ("personal", "plantilla")


# ─── Helpers ────────────────────────────────────────────────────

def _generate_token(db: Session) -> str:
    """Token no adivinable. Reintenta en el caso improbable de colision."""
    for _ in range(5):
        token = secrets.token_urlsafe(16)
        if not db.query(RoutineShareLink.id).filter(RoutineShareLink.token == token).first():
            return token
    raise HTTPException(status_code=500, detail="No se pudo generar el enlace")


def _link_stats(db: Session, link: RoutineShareLink) -> tuple[int, int, int | None]:
    """Visitas, reclamos activos y cupos restantes de un enlace."""
    visits = (
        db.query(sqlfunc.count(ShareLinkVisit.id))
        .filter(ShareLinkVisit.link_id == link.id)
        .scalar() or 0
    )
    claims = (
        db.query(sqlfunc.count(RoutineAssignment.id))
        .filter(
            RoutineAssignment.link_id == link.id,
            RoutineAssignment.status == "active",
        )
        .scalar() or 0
    )
    remaining = None if link.max_claims is None else max(0, link.max_claims - claims)
    return visits, claims, remaining


def _link_response(db: Session, link: RoutineShareLink) -> ShareLinkResponse:
    visits, claims, remaining = _link_stats(db, link)
    return ShareLinkResponse(
        id=link.id,
        token=link.token,
        path=f"/r/{link.token}",
        kind=link.kind,
        label=link.label,
        max_claims=link.max_claims,
        expires_at=link.expires_at,
        revoked=link.revoked,
        visits=visits,
        claims=claims,
        remaining=remaining,
        created_at=link.created_at,
    )


def _own_routine(db: Session, coach: User, routine_id: int) -> Routine:
    """La rutina del coach, o 404. Solo verifica propiedad; que sea plantilla
    lo comprueba quien la usa."""
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == coach.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


# ─── Rutinas de cliente ─────────────────────────────────────────

@router.get("/routines", response_model=list[CoachRoutineResponse])
def list_coach_routines(
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    routines = (
        db.query(Routine)
        .filter(Routine.user_id == coach.id, Routine.is_template == True)  # noqa: E712
        .order_by(Routine.created_at.desc())
        .all()
    )
    out = []
    for r in routines:
        count = (
            db.query(sqlfunc.count(RoutineAssignment.id))
            .filter(
                RoutineAssignment.routine_id == r.id,
                RoutineAssignment.status == "active",
            )
            .scalar() or 0
        )
        out.append(CoachRoutineResponse(
            id=r.id, name=r.name, split_type=r.split_type,
            objective=r.objective, days_per_week=r.days_per_week,
            clients_count=count, created_at=r.created_at,
        ))
    return out


@router.post("/routines", response_model=RoutineResponse, status_code=201)
def create_coach_routine(
    data: RoutineCreate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Crea una rutina para clientes. Nace con is_template=True, asi que no
    aparece en la lista de entrenamiento propia del coach."""
    routine = Routine(
        user_id=coach.id,
        name=data.name,
        split_type=data.split_type,
        objective=data.objective,
        days_per_week=data.days_per_week,
        is_template=True,
    )
    db.add(routine)
    db.flush()

    for day_data in data.days:
        day = RoutineDay(
            routine_id=routine.id,
            day_number=day_data.day_number,
            name=day_data.name,
            focus=day_data.focus,
        )
        db.add(day)
        db.flush()
        for ex in day_data.exercises:
            db.add(RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex.exercise_id,
                order=ex.order,
                sets=ex.sets,
                reps_min=ex.reps_min,
                reps_max=ex.reps_max,
                rest_seconds=ex.rest_seconds,
                notes=ex.notes,
            ))

    db.commit()
    db.refresh(routine)
    return RoutineResponse.model_validate(routine)


# ─── Enlaces ────────────────────────────────────────────────────

@router.post("/routines/{routine_id}/links", response_model=ShareLinkResponse, status_code=201)
def create_share_link(
    routine_id: int,
    data: ShareLinkCreate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    routine = _own_routine(db, coach, routine_id)

    if not routine.is_template:
        raise HTTPException(
            status_code=400,
            detail="Solo puedes compartir rutinas hechas para clientes",
        )
    if data.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de enlace invalido")

    # Un enlace personal es para una persona, sin importar lo que llegue.
    max_claims = 1 if data.kind == "personal" else data.max_claims
    if max_claims is not None and max_claims < 1:
        raise HTTPException(status_code=400, detail="El limite debe ser al menos 1")

    expires_at = None
    if data.expires_in_days is not None:
        if data.expires_in_days < 1:
            raise HTTPException(status_code=400, detail="La expiracion debe ser al menos 1 dia")
        expires_at = now_mx().replace(tzinfo=None) + timedelta(days=data.expires_in_days)

    link = RoutineShareLink(
        token=_generate_token(db),
        routine_id=routine.id,
        coach_id=coach.id,
        kind=data.kind,
        label=(data.label or "").strip() or None,
        max_claims=max_claims,
        expires_at=expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _link_response(db, link)


@router.get("/routines/{routine_id}/links", response_model=list[ShareLinkResponse])
def list_share_links(
    routine_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    _own_routine(db, coach, routine_id)
    links = (
        db.query(RoutineShareLink)
        .filter(
            RoutineShareLink.routine_id == routine_id,
            RoutineShareLink.coach_id == coach.id,
        )
        .order_by(RoutineShareLink.created_at.desc())
        .all()
    )
    return [_link_response(db, l) for l in links]


@router.delete("/links/{link_id}")
def revoke_share_link(
    link_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Revoca el enlace. Quien ya reclamo la rutina la conserva; para quitarle
    el acceso se usa DELETE /coach/assignments/{id}."""
    link = (
        db.query(RoutineShareLink)
        .filter(RoutineShareLink.id == link_id, RoutineShareLink.coach_id == coach.id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")
    link.revoked = True
    db.commit()
    return {"ok": True}
```

- [ ] **Step 5: Registrar el router**

En `backend/app/main.py`, agregar `coach` a la lista de imports de routers y, junto a los demás `include_router`:

```python
app.include_router(coach.router)
```

- [ ] **Step 6: Soportar `is_template` en el generador AI**

En `backend/app/schemas/ai.py`, agregar a `GenerateRoutineRequest`:

```python
    is_template: bool = False  # True = rutina para clientes, creada por un coach
```

En `backend/app/routers/ai.py`, dentro de `generate_smart_routine`, reemplazar el bloque `user_data`:

```python
    # En una rutina de cliente, las condiciones medicas del coach no deben
    # filtrar los ejercicios de otra persona.
    if req.is_template:
        user_data = {
            "has_condition": False,
            "pathologies": None,
            "medications": None,
            "mobility_limitations": None,
            "age": None,
            "weight_kg": None,
        }
    else:
        user_data = {
            "has_condition": user.has_condition if hasattr(user, "has_condition") else False,
            "pathologies": user.pathologies if hasattr(user, "pathologies") else None,
            "medications": user.medications if hasattr(user, "medications") else None,
            "mobility_limitations": user.mobility_limitations if hasattr(user, "mobility_limitations") else None,
            "age": user.age,
            "weight_kg": user.weight_kg,
        }
```

Y donde se crea el objeto `Routine`, agregar el campo:

```python
        is_template=req.is_template,
```

Verificar antes que `generate_routine` tolere `age=None` y `weight_kg=None`; si no lo hace, pasar los valores del coach en esos dos campos y dejar en `None` sólo los médicos, que son los que de verdad filtran ejercicios.

- [ ] **Step 7: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_share_links.py tests/test_auth_deps.py -v
```

Esperado: todas en PASS, incluidas las cuatro de `test_auth_deps.py` que quedaron pendientes en la Task 4.

- [ ] **Step 8: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas/coach.py backend/app/schemas/ai.py backend/app/routers/coach.py backend/app/routers/ai.py backend/app/main.py backend/tests/test_share_links.py backend/tests/test_auth_deps.py
git commit -m "feat: router de coach con rutinas de cliente y enlaces compartibles"
```

---

### Task 8: Router `/share` — vista previa pública y reclamo

**Files:**
- Create: `backend/app/routers/share.py`
- Modify: `backend/app/schemas/coach.py` (dos schemas más)
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_share_claim.py`

**Interfaces:**
- Consumes: `get_optional_user`, `get_current_user` (Task 4); modelos de Task 3
- Produces:
  - `SharePreviewResponse(status, routine_name, coach_name, days_per_week, objective, total_exercises, day_names, already_claimed, is_own)`
  - `ClaimResponse(routine_id, routine_name)`
  - `_link_status(db, link) -> str` — `valido` | `revocado` | `expirado` | `lleno`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_share_claim.py`:

```python
from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.coach import RoutineAssignment, RoutineShareLink, ShareLinkVisit
from app.utils.timezone import now_mx


def _coach_con_enlace(client, db_session, email, kind="plantilla",
                      max_claims=None, expires_in_days=None, name="Josue"):
    coach = make_user(client, email, name=name)
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 4,
        "days": [
            {"day_number": 1, "name": "Pecho/Triceps", "focus": "chest", "exercises": []},
            {"day_number": 2, "name": "Espalda/Biceps", "focus": "back", "exercises": []},
        ],
    })
    rid = res.json()["id"]
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": kind, "label": None,
        "max_claims": max_claims, "expires_in_days": expires_in_days,
    })
    return coach, rid, res.json()["token"]


def test_vista_previa_sin_sesion(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s1@test.com")
    res = client.get(f"/share/{token}")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "valido"
    assert body["routine_name"] == "Full Body"
    assert body["coach_name"] == "Josue"
    assert body["days_per_week"] == 4
    assert body["day_names"] == ["Pecho/Triceps", "Espalda/Biceps"]
    assert body["already_claimed"] is False


def test_vista_previa_no_filtra_ejercicios(client, db_session):
    """Si mandara la rutina completa, el enlace dejaria de ser razon para registrarse."""
    _, _, token = _coach_con_enlace(client, db_session, "s2@test.com")
    body = client.get(f"/share/{token}").json()
    assert "days" not in body
    assert "exercises" not in body
    for clave in body:
        assert "exercise" not in clave or clave == "total_exercises"


def test_token_inexistente(client):
    res = client.get("/share/estonoexiste")
    assert res.status_code == 200
    assert res.json()["status"] == "no_existe"


def test_enlace_revocado(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s3@test.com")
    db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == token
    ).update({"revoked": True})
    db_session.commit()
    assert client.get(f"/share/{token}").json()["status"] == "revocado"


def test_enlace_expirado(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s4@test.com")
    ayer = now_mx().replace(tzinfo=None) - timedelta(days=1)
    db_session.query(RoutineShareLink).filter(
        RoutineShareLink.token == token
    ).update({"expires_at": ayer})
    db_session.commit()
    assert client.get(f"/share/{token}").json()["status"] == "expirado"


def test_enlace_lleno(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s5@test.com", max_claims=1)
    primero = make_user(client, "s5a@test.com")
    assert client.post(f"/share/{token}/claim", headers=primero["headers"]).status_code == 200

    segundo = make_user(client, "s5b@test.com")
    assert client.get(f"/share/{token}").json()["status"] == "lleno"
    res = client.post(f"/share/{token}/claim", headers=segundo["headers"])
    assert res.status_code == 400
    assert "cupo" in res.json()["detail"].lower()


def test_reclamar_crea_asignacion(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s6@test.com")
    cli = make_user(client, "s6a@test.com")
    res = client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert res.status_code == 200
    assert res.json()["routine_id"] == rid
    assert res.json()["routine_name"] == "Full Body"

    a = db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).first()
    assert a is not None
    assert a.status == "active"
    assert a.coach_id == coach["user"]["id"]


def test_reclamar_dos_veces_es_idempotente(client, db_session):
    """Refrescar la pagina no debe quemar un cupo de una plantilla limitada."""
    coach, rid, token = _coach_con_enlace(client, db_session, "s7@test.com", max_claims=5)
    cli = make_user(client, "s7a@test.com")

    r1 = client.post(f"/share/{token}/claim", headers=cli["headers"])
    r2 = client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["routine_id"] == r2.json()["routine_id"]

    total = db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).count()
    assert total == 1

    enlaces = client.get(f"/coach/routines/{rid}/links", headers=coach["headers"]).json()
    assert enlaces[0]["claims"] == 1
    assert enlaces[0]["remaining"] == 4


def test_reclamar_sin_sesion_pide_login(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s8@test.com")
    assert client.post(f"/share/{token}/claim").status_code == 401


def test_already_claimed_con_sesion(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s9@test.com")
    cli = make_user(client, "s9a@test.com")
    assert client.get(f"/share/{token}", headers=cli["headers"]).json()["already_claimed"] is False
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert client.get(f"/share/{token}", headers=cli["headers"]).json()["already_claimed"] is True


def test_token_invalido_no_rompe_la_vista_previa(client, db_session):
    """Un token vencido en el navegador no debe tumbar la pantalla publica."""
    _, _, token = _coach_con_enlace(client, db_session, "s10@test.com")
    res = client.get(f"/share/{token}", headers={"Authorization": "Bearer basura"})
    assert res.status_code == 200
    assert res.json()["status"] == "valido"
    assert res.json()["already_claimed"] is False


def test_el_coach_no_reclama_su_propio_enlace(client, db_session):
    coach, _, token = _coach_con_enlace(client, db_session, "s11@test.com")
    assert client.get(f"/share/{token}", headers=coach["headers"]).json()["is_own"] is True
    res = client.post(f"/share/{token}/claim", headers=coach["headers"])
    assert res.status_code == 400
    assert "tuya" in res.json()["detail"].lower()


def test_la_visita_queda_registrada(client, db_session):
    _, _, token = _coach_con_enlace(client, db_session, "s12@test.com")
    client.get(f"/share/{token}")
    cli = make_user(client, "s12a@test.com")
    client.get(f"/share/{token}", headers=cli["headers"])

    link = db_session.query(RoutineShareLink).filter(RoutineShareLink.token == token).first()
    visitas = db_session.query(ShareLinkVisit).filter(ShareLinkVisit.link_id == link.id).all()
    assert len(visitas) == 2
    assert visitas[0].user_id is None
    assert visitas[1].user_id == cli["user"]["id"]


def test_revocar_acceso_libera_el_cupo(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "s13@test.com", max_claims=1)
    cli = make_user(client, "s13a@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert client.get(f"/share/{token}").json()["status"] == "lleno"

    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.routine_id == rid,
        RoutineAssignment.client_id == cli["user"]["id"],
    ).update({"status": "revoked"})
    db_session.commit()

    assert client.get(f"/share/{token}").json()["status"] == "valido"
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_share_claim.py -v
```

Esperado: FAIL, 404 en todo — el router `/share` no existe.

- [ ] **Step 3: Agregar los schemas**

Al final de `backend/app/schemas/coach.py`:

```python
# ─── Compartir ──────────────────────────────────────────────────

class SharePreviewResponse(BaseModel):
    """Vista previa publica. Deliberadamente sin ejercicios: si mandara la
    rutina completa, cualquiera la copiaria sin registrarse."""
    status: str                    # 'valido' | 'revocado' | 'expirado' | 'lleno' | 'no_existe'
    routine_name: str | None = None
    coach_name: str | None = None
    days_per_week: int | None = None
    objective: str | None = None
    total_exercises: int = 0
    day_names: list[str] = []
    already_claimed: bool = False
    is_own: bool = False


class ClaimResponse(BaseModel):
    routine_id: int
    routine_name: str
```

- [ ] **Step 4: Crear `backend/app/routers/share.py`**

```python
"""Enlace compartido: vista previa publica y reclamo.

GET  /share/{token}        sin sesion obligatoria — la usa cualquiera
POST /share/{token}/claim  con sesion — crea la asignacion
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.auth.security import get_current_user, get_optional_user
from app.database import get_db
from app.models.coach import RoutineAssignment, RoutineShareLink, ShareLinkVisit
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.user import User
from app.schemas.coach import ClaimResponse, SharePreviewResponse
from app.utils.timezone import now_mx

router = APIRouter(prefix="/share", tags=["Compartir"])


def _active_claims(db: Session, link_id: int) -> int:
    return (
        db.query(sqlfunc.count(RoutineAssignment.id))
        .filter(
            RoutineAssignment.link_id == link_id,
            RoutineAssignment.status == "active",
        )
        .scalar() or 0
    )


def _link_status(db: Session, link: RoutineShareLink) -> str:
    """Estado del enlace, en el orden en que el usuario deberia enterarse."""
    if link.revoked:
        return "revocado"
    if link.expires_at and link.expires_at < now_mx().replace(tzinfo=None):
        return "expirado"
    if link.max_claims is not None and _active_claims(db, link.id) >= link.max_claims:
        return "lleno"
    return "valido"


ERRORES = {
    "revocado": "Este enlace ya no esta disponible",
    "expirado": "Este enlace expiro",
    "lleno": "Este enlace ya no tiene cupo disponible",
    "no_existe": "Este enlace no existe",
}


@router.get("/{token}", response_model=SharePreviewResponse)
def preview_share_link(
    token: str,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    link = db.query(RoutineShareLink).filter(RoutineShareLink.token == token).first()
    if not link:
        return SharePreviewResponse(status="no_existe")

    db.add(ShareLinkVisit(link_id=link.id, user_id=user.id if user else None))
    db.commit()

    routine = db.query(Routine).filter(Routine.id == link.routine_id).first()
    if not routine:
        return SharePreviewResponse(status="no_existe")

    coach = db.query(User).filter(User.id == link.coach_id).first()
    days = (
        db.query(RoutineDay)
        .filter(RoutineDay.routine_id == routine.id)
        .order_by(RoutineDay.day_number)
        .all()
    )
    total_exercises = (
        db.query(sqlfunc.count(RoutineExercise.id))
        .join(RoutineDay, RoutineExercise.routine_day_id == RoutineDay.id)
        .filter(RoutineDay.routine_id == routine.id)
        .scalar() or 0
    )

    already = False
    if user:
        already = db.query(RoutineAssignment.id).filter(
            RoutineAssignment.routine_id == routine.id,
            RoutineAssignment.client_id == user.id,
            RoutineAssignment.status == "active",
        ).first() is not None

    estado = _link_status(db, link)
    # Si ya la reclamo, el enlace le sirve aunque este lleno: es su rutina.
    if already and estado == "lleno":
        estado = "valido"

    return SharePreviewResponse(
        status=estado,
        routine_name=routine.name,
        coach_name=coach.name if coach else None,
        days_per_week=routine.days_per_week,
        objective=routine.objective,
        total_exercises=total_exercises,
        day_names=[d.name for d in days],
        already_claimed=already,
        is_own=bool(user and user.id == link.coach_id),
    )


@router.post("/{token}/claim", response_model=ClaimResponse)
def claim_share_link(
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = db.query(RoutineShareLink).filter(RoutineShareLink.token == token).first()
    if not link:
        raise HTTPException(status_code=404, detail=ERRORES["no_existe"])

    routine = db.query(Routine).filter(Routine.id == link.routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail=ERRORES["no_existe"])

    if user.id == link.coach_id:
        raise HTTPException(status_code=400, detail="Esta rutina ya es tuya")

    # Idempotente: refrescar la pagina no crea otra asignacion ni consume cupo.
    existente = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.routine_id == routine.id,
            RoutineAssignment.client_id == user.id,
        )
        .first()
    )
    if existente:
        if existente.status != "active":
            raise HTTPException(
                status_code=403,
                detail="Tu coach quito tu acceso a esta rutina",
            )
        return ClaimResponse(routine_id=routine.id, routine_name=routine.name)

    estado = _link_status(db, link)
    if estado != "valido":
        raise HTTPException(status_code=400, detail=ERRORES[estado])

    db.add(RoutineAssignment(
        routine_id=routine.id,
        client_id=user.id,
        coach_id=link.coach_id,
        link_id=link.id,
    ))
    ultima_visita = (
        db.query(ShareLinkVisit)
        .filter(ShareLinkVisit.link_id == link.id, ShareLinkVisit.user_id == user.id)
        .order_by(ShareLinkVisit.id.desc())
        .first()
    )
    if ultima_visita:
        ultima_visita.claimed = True
    db.commit()

    return ClaimResponse(routine_id=routine.id, routine_name=routine.name)
```

- [ ] **Step 5: Registrar el router**

En `backend/app/main.py`, agregar `share` a los imports de routers y:

```python
app.include_router(share.router)
```

- [ ] **Step 6: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_share_claim.py -v
```

Esperado: los 13 en PASS.

- [ ] **Step 7: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/share.py backend/app/schemas/coach.py backend/app/main.py backend/tests/test_share_claim.py
git commit -m "feat: vista previa publica y reclamo de enlace de rutina"
```

---

### Task 9: Solicitudes de cambio (backend punta a punta)

**Files:**
- Modify: `backend/app/routers/routines.py` (endpoint del cliente)
- Modify: `backend/app/routers/coach.py` (listar y responder)
- Create: `backend/tests/test_change_requests.py`

**Interfaces:**
- Consumes: `get_assignment` (Task 5), `ChangeRequestCreate` / `ChangeRequestResponse` / `ChangeRequestUpdate` (Task 7)
- Produces:
  - `POST /routines/{routine_id}/change-request` → `ChangeRequestResponse`
  - `GET /coach/change-requests?status=` → `list[ChangeRequestResponse]`
  - `PUT /coach/change-requests/{id}` → `ChangeRequestResponse`
  - `_change_request_response(db, req) -> ChangeRequestResponse` — helper compartido, definido en `coach.py` e importado por `routines.py`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_change_requests.py`:

```python
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
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_change_requests.py -v
```

Esperado: FAIL, 405 o 404 — los endpoints no existen.

- [ ] **Step 3: Agregar el helper y los endpoints de coach**

Al final de `backend/app/routers/coach.py`:

```python
# ─── Solicitudes de cambio ──────────────────────────────────────

VALID_REQUEST_STATUS = ("pendiente", "aceptada", "rechazada")


def _change_request_response(db: Session, req: RoutineChangeRequest) -> ChangeRequestResponse:
    """Arma la respuesta con el contexto que el coach necesita para decidir:
    quien pidio, en que rutina y sobre que ejercicio."""
    assignment = db.query(RoutineAssignment).filter(
        RoutineAssignment.id == req.assignment_id
    ).first()
    routine = db.query(Routine).filter(Routine.id == assignment.routine_id).first()
    cliente = db.query(User).filter(User.id == req.client_id).first()

    exercise_name = None
    if req.routine_exercise_id:
        rex = db.query(RoutineExercise).filter(
            RoutineExercise.id == req.routine_exercise_id
        ).first()
        if rex and rex.exercise:
            exercise_name = rex.exercise.name_es or rex.exercise.name

    return ChangeRequestResponse(
        id=req.id,
        client_id=req.client_id,
        client_name=cliente.name if cliente else "?",
        routine_id=routine.id if routine else 0,
        routine_name=routine.name if routine else "?",
        exercise_name=exercise_name,
        content=req.content,
        status=req.status,
        coach_reply=req.coach_reply,
        created_at=req.created_at,
    )


@router.get("/change-requests", response_model=list[ChangeRequestResponse])
def list_change_requests(
    status: str | None = None,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(RoutineChangeRequest)
        .join(RoutineAssignment, RoutineChangeRequest.assignment_id == RoutineAssignment.id)
        .filter(RoutineAssignment.coach_id == coach.id)
    )
    if status:
        query = query.filter(RoutineChangeRequest.status == status)
    reqs = query.order_by(RoutineChangeRequest.created_at.desc()).all()
    return [_change_request_response(db, r) for r in reqs]


@router.put("/change-requests/{request_id}", response_model=ChangeRequestResponse)
def reply_change_request(
    request_id: int,
    data: ChangeRequestUpdate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    req = (
        db.query(RoutineChangeRequest)
        .join(RoutineAssignment, RoutineChangeRequest.assignment_id == RoutineAssignment.id)
        .filter(
            RoutineChangeRequest.id == request_id,
            RoutineAssignment.coach_id == coach.id,
        )
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if data.status not in VALID_REQUEST_STATUS:
        raise HTTPException(status_code=400, detail="Estado invalido")

    req.status = data.status
    if data.coach_reply is not None:
        req.coach_reply = data.coach_reply.strip() or None
    db.commit()
    db.refresh(req)
    return _change_request_response(db, req)
```

Agregar a los imports de `coach.py`:

```python
from app.models.coach import RoutineChangeRequest
from app.schemas.coach import ChangeRequestResponse, ChangeRequestUpdate
```

- [ ] **Step 4: Agregar el endpoint del cliente**

En `backend/app/routers/routines.py`, entre los routes estáticos y los parametrizados — es decir **antes** de `@router.put("/{routine_id}/schedule")`, respetando el orden que el archivo documenta en su comentario de cabecera:

```python
@router.post("/{routine_id}/change-request", response_model=ChangeRequestResponse, status_code=201)
def create_change_request(
    routine_id: int,
    data: ChangeRequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """El cliente le pide un cambio a su coach.

    Solo tiene sentido sobre una rutina asignada: el dueno la edita directo.
    """
    assignment = get_assignment(db, user.id, routine_id)
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="Solo puedes pedir cambios en una rutina que te asigno tu coach",
        )
    contenido = (data.content or "").strip()
    if not contenido:
        raise HTTPException(status_code=400, detail="Escribe que necesitas cambiar")
    if len(contenido) > 1000:
        raise HTTPException(status_code=400, detail="Maximo 1000 caracteres")

    req = RoutineChangeRequest(
        assignment_id=assignment.id,
        client_id=user.id,
        routine_exercise_id=data.routine_exercise_id,
        content=contenido,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _change_request_response(db, req)
```

Agregar a los imports de `routines.py`:

```python
from app.models.coach import RoutineChangeRequest
from app.schemas.coach import ChangeRequestCreate, ChangeRequestResponse
from app.services.routine_access import get_assignment
from app.routers.coach import _change_request_response
```

Si el import de `coach` genera un ciclo (`coach.py` no importa `routines.py`, así que no debería), mover `_change_request_response` a `app/services/coach_notifications.py` no es la solución: crear entonces `app/services/change_requests.py` con esa única función e importarla desde ambos routers.

- [ ] **Step 5: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_change_requests.py -v
```

Esperado: los 11 en PASS.

- [ ] **Step 6: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/coach.py backend/app/routers/routines.py backend/tests/test_change_requests.py
git commit -m "feat: solicitudes de cambio del cliente al coach"
```

---

### Task 10: `/coach/clients` — adherencia

**Files:**
- Modify: `backend/app/routers/coach.py`
- Create: `backend/tests/test_coach_clients.py`

**Interfaces:**
- Consumes: `CoachClientResponse` (Task 7)
- Produces:
  - `GET /coach/clients` → `list[CoachClientResponse]`
  - `GET /coach/clients/{user_id}` → `list[CoachClientResponse]` (una fila por rutina asignada a ese cliente)
  - `DELETE /coach/assignments/{assignment_id}` → `{"ok": True}`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_coach_clients.py`:

```python
from datetime import timedelta

from tests.conftest import make_user
from app.models.user import User
from app.models.coach import RoutineAssignment
from app.models.workout import Workout
from app.utils.timezone import today_mx


def _coach_con_cliente(client, db_session, sufijo, dias=4):
    coach = make_user(client, f"cc{sufijo}c@test.com", name="Josue")
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": dias, "days": [],
    })
    rid = res.json()["id"]
    cli = make_user(client, f"cc{sufijo}u@test.com", name="Juan Perez")
    a = RoutineAssignment(
        routine_id=rid, client_id=cli["user"]["id"], coach_id=coach["user"]["id"],
    )
    db_session.add(a)
    db_session.commit()
    return coach, cli, rid, a.id


def test_cliente_sin_entrenos(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "1")
    res = client.get("/coach/clients", headers=coach["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    fila = res.json()[0]
    assert fila["name"] == "Juan Perez"
    assert fila["routine_name"] == "Full Body"
    assert fila["days_per_week"] == 4
    assert fila["last_workout_date"] is None
    assert fila["workouts_this_week"] == 0
    assert fila["pending_requests"] == 0
    assert fila["assignment_id"] == aid


def test_cuenta_entrenos_de_la_semana(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "2")
    hoy = today_mx()
    lunes = hoy - timedelta(days=hoy.weekday())
    # Tres entrenos desde el lunes de esta semana, uno de la semana pasada.
    for offset in (0, 1, 2):
        dia = lunes + timedelta(days=offset)
        if dia <= hoy:
            db_session.add(Workout(user_id=cli["user"]["id"], date=dia))
    db_session.add(Workout(user_id=cli["user"]["id"], date=lunes - timedelta(days=3)))
    db_session.commit()

    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    esperados = len([o for o in (0, 1, 2) if lunes + timedelta(days=o) <= hoy])
    assert fila["workouts_this_week"] == esperados
    assert fila["last_workout_date"] is not None


def test_cuenta_solicitudes_pendientes(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "3")
    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio uno",
    })
    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio dos",
    })
    fila = client.get("/coach/clients", headers=coach["headers"]).json()[0]
    assert fila["pending_requests"] == 2


def test_coach_no_ve_clientes_de_otro_coach(client, db_session):
    a_coach, _, _, _ = _coach_con_cliente(client, db_session, "4a")
    b_coach, _, _, _ = _coach_con_cliente(client, db_session, "4b")
    nombres = [f["email"] for f in client.get("/coach/clients",
                                              headers=b_coach["headers"]).json()]
    assert "cc4au@test.com" not in nombres


def test_asignacion_revocada_no_sale(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "5")
    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.id == aid
    ).update({"status": "revoked"})
    db_session.commit()
    assert client.get("/coach/clients", headers=coach["headers"]).json() == []


def test_quitar_acceso(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "6")
    res = client.delete(f"/coach/assignments/{aid}", headers=coach["headers"])
    assert res.status_code == 200
    assert client.get("/coach/clients", headers=coach["headers"]).json() == []
    # El cliente pierde la rutina
    assert client.get(f"/routines/{rid}", headers=cli["headers"]).status_code == 404


def test_quitar_acceso_conserva_el_historial(client, db_session):
    """Los workouts del cliente son suyos: alimentan sus graficas y sus 1RM."""
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "7")
    db_session.add(Workout(user_id=cli["user"]["id"], date=today_mx()))
    db_session.commit()

    client.delete(f"/coach/assignments/{aid}", headers=coach["headers"])
    quedan = db_session.query(Workout).filter(Workout.user_id == cli["user"]["id"]).count()
    assert quedan == 1


def test_no_se_quita_acceso_de_otro_coach(client, db_session):
    a_coach, _, _, a_aid = _coach_con_cliente(client, db_session, "8a")
    b_coach, _, _, _ = _coach_con_cliente(client, db_session, "8b")
    res = client.delete(f"/coach/assignments/{a_aid}", headers=b_coach["headers"])
    assert res.status_code == 404


def test_detalle_de_un_cliente(client, db_session):
    coach, cli, rid, aid = _coach_con_cliente(client, db_session, "9")
    res = client.get(f"/coach/clients/{cli['user']['id']}", headers=coach["headers"])
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["routine_id"] == rid
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_coach_clients.py -v
```

Esperado: FAIL, 404 — los endpoints no existen.

- [ ] **Step 3: Agregar los endpoints**

Al final de `backend/app/routers/coach.py`:

```python
# ─── Clientes y adherencia ──────────────────────────────────────

def _client_row(db: Session, assignment: RoutineAssignment) -> CoachClientResponse:
    """Una fila de adherencia. Todo sale de datos que ya existen: no hay
    tablas nuevas para esto."""
    cliente = db.query(User).filter(User.id == assignment.client_id).first()
    routine = db.query(Routine).filter(Routine.id == assignment.routine_id).first()

    hoy = today_mx()
    lunes = hoy - timedelta(days=hoy.weekday())

    ultimo = (
        db.query(sqlfunc.max(Workout.date))
        .filter(Workout.user_id == assignment.client_id)
        .scalar()
    )
    esta_semana = (
        db.query(sqlfunc.count(Workout.id))
        .filter(
            Workout.user_id == assignment.client_id,
            Workout.date >= lunes,
            Workout.date <= hoy,
        )
        .scalar() or 0
    )
    pendientes = (
        db.query(sqlfunc.count(RoutineChangeRequest.id))
        .filter(
            RoutineChangeRequest.assignment_id == assignment.id,
            RoutineChangeRequest.status == "pendiente",
        )
        .scalar() or 0
    )

    return CoachClientResponse(
        assignment_id=assignment.id,
        user_id=assignment.client_id,
        name=cliente.name if cliente else "?",
        email=cliente.email if cliente else "?",
        routine_id=assignment.routine_id,
        routine_name=routine.name if routine else "?",
        last_workout_date=ultimo.isoformat() if ultimo else None,
        workouts_this_week=esta_semana,
        days_per_week=routine.days_per_week if routine else 0,
        pending_requests=pendientes,
    )


@router.get("/clients", response_model=list[CoachClientResponse])
def list_clients(
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    asignaciones = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.coach_id == coach.id,
            RoutineAssignment.status == "active",
        )
        .order_by(RoutineAssignment.assigned_at.desc())
        .all()
    )
    return [_client_row(db, a) for a in asignaciones]


@router.get("/clients/{user_id}", response_model=list[CoachClientResponse])
def get_client_detail(
    user_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Una fila por cada rutina que el coach le tiene asignada a ese cliente."""
    asignaciones = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.coach_id == coach.id,
            RoutineAssignment.client_id == user_id,
            RoutineAssignment.status == "active",
        )
        .all()
    )
    if not asignaciones:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return [_client_row(db, a) for a in asignaciones]


@router.delete("/assignments/{assignment_id}")
def revoke_assignment(
    assignment_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Quita el acceso. No borra el historial del cliente: sus workouts y su
    progreso son suyos y alimentan sus graficas."""
    assignment = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.id == assignment_id,
            RoutineAssignment.coach_id == coach.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    assignment.status = "revoked"
    db.commit()
    return {"ok": True}
```

Agregar a los imports de `coach.py`:

```python
from app.models.workout import Workout
from app.schemas.coach import CoachClientResponse
from app.utils.timezone import today_mx
```

- [ ] **Step 4: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_coach_clients.py -v
```

Esperado: los 9 en PASS.

- [ ] **Step 5: Ejecutar todo**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/coach.py backend/tests/test_coach_clients.py
git commit -m "feat: panel de clientes del coach con adherencia"
```

---

### Task 11: Notificaciones

Cuatro avisos sobre la infraestructura que ya existe. El de "tu coach actualizó tu rutina" es el que hace útil el modelo en vivo: sin él, el coach cambia la rutina y el cliente entrena la de ayer sin enterarse.

**Files:**
- Create: `backend/app/services/coach_notifications.py`
- Modify: `backend/app/routers/share.py` (aviso de reclamo)
- Modify: `backend/app/routers/routines.py` (aviso de solicitud y de edición)
- Modify: `backend/app/routers/coach.py` (aviso de respuesta)
- Create: `backend/tests/test_coach_notifications.py`

**Interfaces:**
- Consumes: `Notification` (existente), `send_push_to_user` (existente), `RoutineAssignment` (Task 3)
- Produces:
  - `notify_claim(db, coach_id: int, client_name: str, routine_name: str) -> None`
  - `notify_change_request(db, coach_id: int, client_name: str, exercise_name: str | None) -> None`
  - `notify_request_reply(db, client_id: int, routine_name: str, reply: str | None) -> None`
  - `notify_routine_updated(db, routine_id: int, coach_name: str) -> None`

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_coach_notifications.py`:

```python
from tests.conftest import make_user
from app.models.user import User
from app.models.notification import Notification
from app.models.coach import RoutineAssignment


def _coach_con_enlace(client, db_session, sufijo):
    coach = make_user(client, f"nt{sufijo}c@test.com", name="Josue")
    db_session.query(User).filter(User.id == coach["user"]["id"]).update({"is_coach": True})
    db_session.commit()
    res = client.post("/coach/routines", headers=coach["headers"], json={
        "name": "Full Body", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    rid = res.json()["id"]
    res = client.post(f"/coach/routines/{rid}/links", headers=coach["headers"], json={
        "kind": "plantilla", "label": None, "max_claims": None, "expires_in_days": None,
    })
    return coach, rid, res.json()["token"]


def _notifs(db_session, user_id):
    return db_session.query(Notification).filter(Notification.user_id == user_id).all()


def test_avisa_al_coach_cuando_reclaman(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "1")
    cli = make_user(client, "nt1u@test.com", name="Juan Perez")
    client.post(f"/share/{token}/claim", headers=cli["headers"])

    avisos = _notifs(db_session, coach["user"]["id"])
    assert len(avisos) == 1
    assert "Juan Perez" in avisos[0].body
    assert "Full Body" in avisos[0].body
    assert avisos[0].url == "/coach"


def test_reclamo_idempotente_no_avisa_dos_veces(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "2")
    cli = make_user(client, "nt2u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    assert len(_notifs(db_session, coach["user"]["id"])) == 1


def test_avisa_al_coach_de_una_solicitud(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "3")
    cli = make_user(client, "nt3u@test.com", name="Juan")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Me duele la rodilla",
    })
    avisos = _notifs(db_session, coach["user"]["id"])
    assert len(avisos) == 1
    assert "Juan" in avisos[0].body


def test_avisa_al_cliente_de_la_respuesta(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "4")
    cli = make_user(client, "nt4u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    res = client.post(f"/routines/{rid}/change-request", headers=cli["headers"], json={
        "routine_exercise_id": None, "content": "Cambio",
    })
    req_id = res.json()["id"]
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/coach/change-requests/{req_id}", headers=coach["headers"], json={
        "status": "aceptada", "coach_reply": "Listo, ya te lo cambie",
    })
    avisos = _notifs(db_session, cli["user"]["id"])
    assert len(avisos) == 1
    assert "Listo" in avisos[0].body


def test_avisa_al_cliente_cuando_el_coach_edita(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "5")
    cli = make_user(client, "nt5u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "Full Body v2"})
    avisos = _notifs(db_session, cli["user"]["id"])
    assert len(avisos) == 1
    assert "actualiz" in avisos[0].body.lower()
    assert avisos[0].url == f"/routines/{rid}"


def test_editar_una_rutina_sin_asignados_no_avisa_a_nadie(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "6")
    db_session.query(Notification).delete()
    db_session.commit()
    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "Otro nombre"})
    assert db_session.query(Notification).count() == 0


def test_avisa_a_todos_los_asignados(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "7")
    a = make_user(client, "nt7a@test.com")
    b = make_user(client, "nt7b@test.com")
    client.post(f"/share/{token}/claim", headers=a["headers"])
    client.post(f"/share/{token}/claim", headers=b["headers"])
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "v2"})
    assert len(_notifs(db_session, a["user"]["id"])) == 1
    assert len(_notifs(db_session, b["user"]["id"])) == 1


def test_asignado_revocado_no_recibe_aviso_de_edicion(client, db_session):
    coach, rid, token = _coach_con_enlace(client, db_session, "8")
    cli = make_user(client, "nt8u@test.com")
    client.post(f"/share/{token}/claim", headers=cli["headers"])
    db_session.query(RoutineAssignment).filter(
        RoutineAssignment.client_id == cli["user"]["id"]
    ).update({"status": "revoked"})
    db_session.query(Notification).delete()
    db_session.commit()

    client.put(f"/routines/{rid}", headers=coach["headers"], json={"name": "v2"})
    assert _notifs(db_session, cli["user"]["id"]) == []
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_coach_notifications.py -v
```

Esperado: FAIL — no se crea ninguna notificación.

- [ ] **Step 3: Crear `backend/app/services/coach_notifications.py`**

```python
"""Avisos de la relacion coach-cliente.

Reutilizan la tabla Notification y el push que ya existen. Cada uno se llama
envuelto en try/except desde el endpoint: un fallo de push nunca debe tumbar
la operacion principal.
"""

import logging

from sqlalchemy.orm import Session

from app.models.coach import RoutineAssignment
from app.models.notification import Notification
from app.models.routine import Routine
from app.services.push_service import send_push_to_user

logger = logging.getLogger(__name__)


def _notify(db: Session, user_id: int, title: str, body: str, url: str) -> None:
    """Notificacion en la app mas push. El push puede fallar sin consecuencias."""
    db.add(Notification(user_id=user_id, title=title, body=body, url=url))
    db.commit()
    try:
        send_push_to_user(db, user_id, title, body, url)
    except Exception as e:
        logger.warning(f"Push fallido para el usuario #{user_id}: {e}")


def notify_claim(db: Session, coach_id: int, client_name: str, routine_name: str) -> None:
    _notify(
        db, coach_id,
        "Nuevo cliente",
        f"{client_name} reclamo {routine_name}",
        "/coach",
    )


def notify_change_request(
    db: Session, coach_id: int, client_name: str, exercise_name: str | None
) -> None:
    detalle = f" en {exercise_name}" if exercise_name else ""
    _notify(
        db, coach_id,
        "Solicitud de cambio",
        f"{client_name} pidio un cambio{detalle}",
        "/coach",
    )


def notify_request_reply(
    db: Session, client_id: int, routine_name: str, reply: str | None
) -> None:
    cuerpo = reply.strip() if reply and reply.strip() else f"Tu coach respondio sobre {routine_name}"
    _notify(
        db, client_id,
        "Respuesta de tu coach",
        cuerpo[:400],
        "/routines",
    )


def notify_routine_updated(db: Session, routine_id: int, coach_name: str) -> None:
    """Avisa a todos los clientes con asignacion activa.

    Sin este aviso el modelo en vivo no sirve: el coach cambia la rutina y el
    cliente entrena la de ayer sin enterarse.
    """
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    nombre = routine.name if routine else "tu rutina"
    asignaciones = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.routine_id == routine_id,
            RoutineAssignment.status == "active",
        )
        .all()
    )
    for a in asignaciones:
        _notify(
            db, a.client_id,
            "Rutina actualizada",
            f"{coach_name} actualizo {nombre}",
            f"/routines/{routine_id}",
        )
```

- [ ] **Step 4: Enganchar el aviso de reclamo**

En `backend/app/routers/share.py`, dentro de `claim_share_link`, después del `db.commit()` que crea la asignación y **antes** del `return`:

```python
    try:
        notify_claim(db, link.coach_id, user.name, routine.name)
    except Exception:
        pass
```

Import:

```python
from app.services.coach_notifications import notify_claim
```

El aviso va después del `return` temprano del caso idempotente, así que reclamar dos veces no avisa dos veces.

- [ ] **Step 5: Enganchar el aviso de solicitud**

En `backend/app/routers/routines.py`, en `create_change_request`, antes del `return`:

```python
    respuesta = _change_request_response(db, req)
    try:
        notify_change_request(
            db, assignment.coach_id, user.name, respuesta.exercise_name,
        )
    except Exception:
        pass
    return respuesta
```

- [ ] **Step 6: Enganchar el aviso de edición**

En `backend/app/routers/routines.py`, en `update_routine`, después del `db.commit()`:

```python
    try:
        notify_routine_updated(db, routine.id, user.name)
    except Exception:
        pass
```

Imports en `routines.py`:

```python
from app.services.coach_notifications import notify_change_request, notify_routine_updated
```

Nota de alcance: este aviso sólo cuelga de `update_routine` (cambio de nombre). Los endpoints que editan ejercicios (`update_exercise`, `swap_exercise`, `delete_exercise`, `add_exercise`, `regenerate_day_exercises`) no avisan, para no bombardear al cliente con una notificación por cada ajuste mientras el coach arma la rutina. Si más adelante se quiere avisar de esos, el lugar correcto es un aviso agrupado por rutina y por día, no uno por endpoint.

- [ ] **Step 7: Enganchar el aviso de respuesta**

En `backend/app/routers/coach.py`, en `reply_change_request`, antes del `return`:

```python
    respuesta = _change_request_response(db, req)
    try:
        notify_request_reply(db, req.client_id, respuesta.routine_name, req.coach_reply)
    except Exception:
        pass
    return respuesta
```

Import:

```python
from app.services.coach_notifications import notify_request_reply
```

- [ ] **Step 8: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_coach_notifications.py -v
```

Esperado: los 8 en PASS.

- [ ] **Step 9: Ejecutar todo el backend**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS. Con esto el backend queda completo.

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/coach_notifications.py backend/app/routers/share.py backend/app/routers/routines.py backend/app/routers/coach.py backend/tests/test_coach_notifications.py
git commit -m "feat: notificaciones de coach y cliente"
```

---

## Nota sobre las tareas de frontend

El proyecto no tiene banco de pruebas de frontend (no hay vitest, jest ni testing-library en `package.json`), y el spec no pide montarlo. Las tareas 12 a 16 se verifican **a mano** con pasos explícitos. Cada una lista qué abrir, qué hacer y qué debe verse.

Para todas ellas, levantar el entorno una vez:

```bash
cd fitness-app && docker-compose up --build
```

Frontend en `http://localhost:5173`, backend en `http://localhost:8000`.

Antes de empezar la Task 12, crear en la base un coach y una rutina de cliente con un enlace, para tener con qué probar:

```bash
# 1. Registrar dos usuarios desde la UI: coach@test.com y cliente@test.com
# 2. Marcar al coach:
docker-compose exec db psql -U postgres -d fitness_jos \
  -c "UPDATE users SET is_coach = TRUE WHERE email = 'coach@test.com';"
# 3. Crear rutina y enlace vía Swagger en http://localhost:8000/docs
#    POST /coach/routines  →  POST /coach/routines/{id}/links
```

---

### Task 12: Pantalla pública `/r/:token`

**Files:**
- Create: `frontend/src/services/pendingShare.js`
- Create: `frontend/src/pages/SharedRoutine.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `GET /share/{token}`, `POST /share/{token}/claim` (Task 8)
- Produces:
  - `setPendingShare(token: string): void`
  - `getPendingShare(): string | null`
  - `clearPendingShare(): void`
  - Ruta `/r/:token`, pública, fuera de `ProtectedRoute`

- [ ] **Step 1: Crear `frontend/src/services/pendingShare.js`**

```js
// Token del enlace que el usuario abrió pero aún no reclama.
//
// Respaldo del parámetro ?redirect=. El caso más común de todos —cliente nuevo
// que abre el enlace en el celular y se registra— pierde el redirect con
// facilidad, y sin este respaldo termina sin rutina y sin saber por qué.

const KEY = 'pending_share_token'

export function setPendingShare(token) {
  if (!token) return
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    // Modo privado de Safari puede bloquear sessionStorage. El redirect sigue.
  }
}

export function getPendingShare() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingShare() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // sin consecuencias
  }
}
```

- [ ] **Step 2: Crear `frontend/src/pages/SharedRoutine.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Flame, Calendar, Dumbbell, User as UserIcon, AlertCircle } from 'lucide-react'

import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { setPendingShare, clearPendingShare } from '../services/pendingShare'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const OBJECTIVE_LABELS = {
  hypertrophy: 'Hipertrofia',
  strength: 'Fuerza',
  fat_loss: 'Perdida de grasa',
  recomposition: 'Recomposicion',
  endurance: 'Resistencia',
}

const MENSAJES_ERROR = {
  no_existe: 'Este enlace no existe. Revisa que lo hayas copiado completo.',
  revocado: 'Tu coach desactivo este enlace.',
  expirado: 'Este enlace expiro. Pidele uno nuevo a tu coach.',
  lleno: 'Este enlace ya no tiene cupo. Pidele uno nuevo a tu coach.',
}

export default function SharedRoutine() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    setPendingShare(token)
    api.get(`/share/${token}`)
      .then(({ data }) => {
        setPreview(data)
        if (data.status !== 'valido') clearPendingShare()
      })
      .catch(() => setError('No pudimos cargar el enlace. Revisa tu conexion.'))
      .finally(() => setLoading(false))
  }, [token, authLoading])

  const reclamar = async () => {
    setClaiming(true)
    setError('')
    try {
      const { data } = await api.post(`/share/${token}/claim`)
      clearPendingShare()
      navigate(`/routines/${data.routine_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos agregar la rutina')
    } finally {
      setClaiming(false)
    }
  }

  if (authLoading || loading) return <LoadingSpinner />

  const invalido = preview && preview.status !== 'valido'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Flame size={40} className="text-brand-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">JOSSFITness</h1>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {invalido ? (
          <div className="card text-center py-10">
            <AlertCircle size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-600 dark:text-gray-300 font-medium">
              {MENSAJES_ERROR[preview.status] || 'Este enlace no esta disponible'}
            </p>
            <Link to="/" className="btn-secondary inline-block mt-5 text-sm py-2 px-4">
              Ir a la app
            </Link>
          </div>
        ) : preview ? (
          <div className="card">
            <p className="text-[11px] uppercase tracking-wide text-brand-500 font-semibold">
              Rutina de tu coach
            </p>
            <h2 className="text-xl font-bold mt-1">{preview.routine_name}</h2>

            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
              {preview.coach_name && (
                <span className="flex items-center gap-1">
                  <UserIcon size={11} /> {preview.coach_name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={11} /> {preview.days_per_week} dias/sem
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell size={11} /> {preview.total_exercises} ejercicios
              </span>
              {preview.objective && (
                <span>{OBJECTIVE_LABELS[preview.objective] || preview.objective}</span>
              )}
            </div>

            {preview.day_names?.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
                {preview.day_names.map((nombre, i) => (
                  <div key={i}
                    className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
                    {nombre}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              {preview.is_own ? (
                <p className="text-sm text-gray-500 text-center">
                  Esta rutina es tuya. Compartela con tus clientes.
                </p>
              ) : !user ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                    Entra con tu cuenta para empezar a entrenarla
                  </p>
                  <button
                    onClick={() => navigate(`/register?redirect=/r/${token}`)}
                    className="btn-primary w-full"
                  >
                    Crear cuenta
                  </button>
                  <button
                    onClick={() => navigate(`/login?redirect=/r/${token}`)}
                    className="btn-secondary w-full mt-2"
                  >
                    Ya tengo cuenta
                  </button>
                </>
              ) : preview.already_claimed ? (
                <button onClick={reclamar} className="btn-primary w-full" disabled={claiming}>
                  Ir a mi rutina
                </button>
              ) : (
                <button onClick={reclamar} className="btn-primary w-full" disabled={claiming}>
                  {claiming ? 'Agregando...' : 'Agregar a mis rutinas'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Registrar la ruta pública**

En `frontend/src/App.jsx`, agregar el import:

```jsx
import SharedRoutine from './pages/SharedRoutine'
```

Y la ruta, junto a las públicas (`/login`, `/register`, `/terms`), **fuera** de `ProtectedRoute`:

```jsx
      <Route path="/r/:token" element={<SharedRoutine />} />
```

- [ ] **Step 4: Verificar sin sesión**

1. Cerrar sesión (o abrir una ventana de incógnito)
2. Abrir `http://localhost:5173/r/<token>`

Debe verse: nombre de la rutina, nombre del coach, días por semana, total de ejercicios y los nombres de los días. Y dos botones: **Crear cuenta** y **Ya tengo cuenta**.

**No** debe verse ningún ejercicio con sets ni reps. Confirmarlo también en la pestaña de red del navegador: la respuesta de `GET /share/<token>` no trae `days` con ejercicios.

- [ ] **Step 5: Verificar los enlaces inválidos**

1. Abrir `http://localhost:5173/r/inventado` → *"Este enlace no existe..."*
2. Revocar el enlace desde Swagger (`DELETE /coach/links/{id}`) y recargar → *"Tu coach desactivo este enlace."*

Cada caso con su mensaje propio, nunca una pantalla de error genérica.

- [ ] **Step 6: Verificar con sesión**

1. Iniciar sesión como `cliente@test.com`
2. Abrir el enlace → botón **Agregar a mis rutinas**
3. Tocarlo → debe navegar a `/routines/<id>` y verse la rutina
4. Volver a abrir el enlace → ahora dice **Ir a mi rutina**, y tocarlo lleva a la misma rutina sin crear otra asignación

- [ ] **Step 7: Verificar el respaldo en sessionStorage**

Con la consola del navegador abierta, tras cargar `/r/<token>`:

```js
sessionStorage.getItem('pending_share_token')
```

Debe devolver el token. Después de reclamar, debe devolver `null`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/services/pendingShare.js frontend/src/pages/SharedRoutine.jsx frontend/src/App.jsx
git commit -m "feat: pantalla publica de enlace de rutina compartida"
```

---

### Task 13: Redirección después de iniciar sesión o registrarse

Sin esto, el cliente nuevo se registra y aterriza en el dashboard sin su rutina — el flujo completo se rompe justo en el paso que importa.

**Files:**
- Modify: `frontend/src/pages/Login.jsx`
- Modify: `frontend/src/pages/Register.jsx`

**Interfaces:**
- Consumes: `getPendingShare`, `clearPendingShare` (Task 12)
- Produces: ambas pantallas respetan `?redirect=<ruta>` y, en su defecto, el token pendiente

- [ ] **Step 1: Redirección en `Login.jsx`**

Agregar `useSearchParams` al import de react-router-dom:

```jsx
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
```

Y el import del respaldo:

```jsx
import { getPendingShare } from '../services/pendingShare'
```

Dentro del componente, junto a `const navigate = useNavigate()`:

```jsx
  const [searchParams] = useSearchParams()

  // Prioridad: ?redirect= explicito, luego el token pendiente, luego el inicio.
  const destino = () => {
    const redirect = searchParams.get('redirect')
    if (redirect && redirect.startsWith('/')) return redirect
    const pendiente = getPendingShare()
    if (pendiente) return `/r/${pendiente}`
    return '/'
  }
```

La comprobación `startsWith('/')` evita que un `?redirect=https://otrositio.com` mande al usuario fuera de la app.

En `handleSubmit`, reemplazar `navigate('/')` por:

```jsx
      navigate(destino(), { replace: true })
```

- [ ] **Step 2: Redirección en `Register.jsx`**

Mismos imports:

```jsx
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getPendingShare } from '../services/pendingShare'
```

Y la misma función `destino()` dentro del componente, junto a `const navigate = useNavigate()`:

```jsx
  const [searchParams] = useSearchParams()

  const destino = () => {
    const redirect = searchParams.get('redirect')
    if (redirect && redirect.startsWith('/')) return redirect
    const pendiente = getPendingShare()
    if (pendiente) return `/r/${pendiente}`
    return '/'
  }
```

`Register` no navega al terminar: muestra una pantalla de éxito con un botón **Ir al Dashboard** (`frontend/src/pages/Register.jsx:389-394`). Reemplazar ese botón por:

```jsx
            <button
              onClick={() => navigate(destino(), { replace: true })}
              className="btn-primary w-full"
            >
              {searchParams.get('redirect') || getPendingShare() ? 'Ver mi rutina' : 'Ir al Dashboard'}
            </button>
```

El texto cambia según de dónde venga: quien llegó por un enlace de coach espera ver su rutina, no un dashboard vacío.

- [ ] **Step 3: Verificar el flujo del cliente nuevo**

Este es el camino más importante de toda la funcionalidad.

1. Ventana de incógnito
2. Abrir `http://localhost:5173/r/<token>`
3. Tocar **Crear cuenta** → la URL debe ser `/register?redirect=/r/<token>`
4. Completar el registro con un correo nuevo
5. En la pantalla de éxito, el botón debe decir **Ver mi rutina**
6. Tocarlo → vuelve a `/r/<token>`, ahora con sesión, mostrando **Agregar a mis rutinas**
7. Tocarlo → aterriza en `/routines/<id>` con la rutina

- [ ] **Step 4: Verificar el flujo del cliente existente**

1. Ventana de incógnito, abrir el enlace
2. **Ya tengo cuenta** → `/login?redirect=/r/<token>`
3. Iniciar sesión → vuelve a `/r/<token>` directamente

- [ ] **Step 5: Verificar el respaldo cuando se pierde el redirect**

1. Ventana de incógnito, abrir `/r/<token>`
2. Navegar a mano a `http://localhost:5173/login` (sin el parámetro)
3. Iniciar sesión → debe aterrizar igual en `/r/<token>`, gracias al token en `sessionStorage`

- [ ] **Step 6: Verificar que el login normal no cambió**

Ventana de incógnito nueva (sin token pendiente): entrar por `/login` e iniciar sesión debe llevar al dashboard como siempre.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Login.jsx frontend/src/pages/Register.jsx
git commit -m "feat: login y registro respetan el enlace de rutina pendiente"
```

---

### Task 14: Vista de solo lectura del cliente y solicitud de cambio

**Files:**
- Create: `frontend/src/components/routines/ChangeRequestModal.jsx`
- Modify: `frontend/src/pages/Routines.jsx`
- Modify: `frontend/src/pages/RoutineDetail.jsx`
- Modify: `frontend/src/pages/RoutineDayDetail.jsx`

**Interfaces:**
- Consumes: `read_only` y `assigned_by` en `RoutineResponse` (Task 6); `POST /routines/{id}/change-request` (Task 9)
- Produces: `<ChangeRequestModal routineId exerciseId exerciseName onClose />`

- [ ] **Step 1: Crear `frontend/src/components/routines/ChangeRequestModal.jsx`**

```jsx
import { useState } from 'react'
import { X, Send } from 'lucide-react'

import api from '../../services/api'

export default function ChangeRequestModal({ routineId, exerciseId = null, exerciseName = null, onClose }) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const enviar = async () => {
    if (!content.trim()) { setError('Escribe que necesitas cambiar'); return }
    setSending(true)
    setError('')
    try {
      await api.post(`/routines/${routineId}/change-request`, {
        routine_exercise_id: exerciseId,
        content: content.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos enviar tu solicitud')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4"
      onClick={onClose}>
      <div className="card w-full max-w-sm mb-4 sm:mb-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">Pedir un cambio</h3>
            {exerciseName && (
              <p className="text-[11px] text-gray-400 mt-0.5">{exerciseName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Listo, tu coach ya recibio tu solicitud.
            </p>
            <button onClick={onClose} className="btn-primary w-full mt-4">Cerrar</button>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-lg text-xs mt-3">
                {error}
              </div>
            )}
            <textarea
              className="input mt-3 h-28 resize-none"
              maxLength={1000}
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ej: este ejercicio me lastima la rodilla, prefiero otro"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{content.length}/1000</p>
            <button onClick={enviar} className="btn-primary w-full mt-3 flex items-center justify-center gap-1.5"
              disabled={sending}>
              <Send size={14} /> {sending ? 'Enviando...' : 'Enviar a mi coach'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Distintivo en `Routines.jsx`**

Agregar `UserCheck` al import de lucide-react.

Dentro del `.map((r) => {`, junto a los demás distintivos (donde está el de `generation_type === 'ai'`), agregar:

```jsx
                      {r.read_only && (
                        <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5">
                          <UserCheck size={8} /> {r.assigned_by || 'Coach'}
                        </span>
                      )}
```

Y en el bloque de botones de la derecha, condicionar el botón de borrar (el cliente no puede borrar la rutina de su coach):

```jsx
                    {!r.read_only && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteRoutine(r.id) }}
                        className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
```

Y el lápiz de renombrar, que está junto al `<h3>`:

```jsx
                        {!r.read_only && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditName(r.name); setEditingId(r.id) }}
                            className="p-1 text-gray-300 hover:text-brand-500 transition-colors flex-shrink-0"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
```

- [ ] **Step 3: Solo lectura en `RoutineDetail.jsx`**

Al inicio del componente, después de `const [routine, setRoutine] = useState(null)`:

```jsx
  const readOnly = !!routine?.read_only
```

Justo debajo del encabezado con el nombre de la rutina, agregar el distintivo:

```jsx
      {readOnly && (
        <div className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5">
          <UserCheck size={14} />
          Rutina de tu coach · {routine.assigned_by || 'Coach'}
        </div>
      )}
```

(agregar `UserCheck` al import de lucide-react)

Envolver en `{!readOnly && ( ... )}` estos controles:
- el lápiz que activa `setEditingName(true)` y el `<input>` de renombrar
- el botón que abre el calendario de descansos (`setShowSchedule`)
- los atributos `draggable` y los manejadores `onDragStart` / `onDragOver` / `onDrop` de las tarjetas de día — pasar `draggable={!readOnly}` y salir temprano en cada manejador con `if (readOnly) return`

- [ ] **Step 4: Solo lectura en `RoutineDayDetail.jsx`**

Al inicio del componente, junto al estado de la rutina:

```jsx
  const readOnly = !!routine?.read_only
  const [changeRequestFor, setChangeRequestFor] = useState(null)
```

Envolver en `{!readOnly && ( ... )}` estos controles:
- botón de regenerar ejercicios (`/routines/days/${dayId}/regenerate`)
- botón de agregar ejercicio (`/routines/days/${addingToDay.id}/exercises`)
- botón de swap (`/routines/exercises/${swapExercise.id}/swap`)
- botón de borrar ejercicio (`/routines/exercises/${exId}` DELETE)
- edición de sets y reps (`/routines/exercises/${exId}` PUT)
- modo de selección para enlazar biseries y circuitos (`/routines/exercises/link` y `/unlink`)
- reordenar ejercicios (`draggable={!readOnly}` y salida temprana en los manejadores)

Marcar y registrar series **no** se toca: eso el cliente sí lo hace.

En el menú de cada ejercicio, cuando `readOnly` sea true, agregar el botón de solicitud:

```jsx
              {readOnly && (
                <button
                  onClick={() => setChangeRequestFor({
                    id: ex.id,
                    name: ex.exercise?.name_es || ex.exercise?.name,
                  })}
                  className="text-[11px] text-brand-500 font-medium flex items-center gap-1"
                >
                  <MessageSquarePlus size={12} /> Pedir un cambio
                </button>
              )}
```

(agregar `MessageSquarePlus` al import de lucide-react)

Y al final del JSX del componente, antes del cierre:

```jsx
      {changeRequestFor && (
        <ChangeRequestModal
          routineId={parseInt(id, 10)}
          exerciseId={changeRequestFor.id}
          exerciseName={changeRequestFor.name}
          onClose={() => setChangeRequestFor(null)}
        />
      )}
```

Con el import:

```jsx
import ChangeRequestModal from '../components/routines/ChangeRequestModal'
```

- [ ] **Step 5: Verificar como cliente**

Con sesión de `cliente@test.com`, que ya reclamó la rutina:

1. Ir a **Mis Rutinas** → la rutina del coach aparece con el distintivo del nombre del coach, y **sin** botón de borrar ni lápiz de renombrar
2. Abrirla → arriba se ve *"Rutina de tu coach · ..."*, sin lápiz, sin botón de calendario, y los días no se arrastran
3. Entrar a un día → no hay regenerar, ni agregar, ni swap, ni borrar, ni editar sets/reps, ni modo de selección
4. Marcar un ejercicio como hecho → **sí** funciona, y al recargar sigue marcado
5. Tocar **Pedir un cambio** en un ejercicio → se abre el modal, enviar → *"Listo, tu coach ya recibio tu solicitud."*

- [ ] **Step 6: Verificar que la rutina propia no cambió**

Con la misma sesión, abrir una rutina propia del cliente: todos los controles de edición siguen ahí.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/routines/ChangeRequestModal.jsx frontend/src/pages/Routines.jsx frontend/src/pages/RoutineDetail.jsx frontend/src/pages/RoutineDayDetail.jsx
git commit -m "feat: vista de solo lectura del cliente y solicitud de cambio"
```

---

### Task 15: Panel de coach en el frontend

**Files:**
- Create: `frontend/src/pages/Coach.jsx`
- Create: `frontend/src/components/coach/CoachRoutinesTab.jsx`
- Create: `frontend/src/components/coach/ShareLinkModal.jsx`
- Create: `frontend/src/components/coach/CoachClientsTab.jsx`
- Create: `frontend/src/components/coach/CoachRequestsTab.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: todos los endpoints de `/coach` (Tasks 7, 9, 10)
- Produces: ruta `/coach` protegida por `CoachRoute`; los cuatro componentes de arriba

- [ ] **Step 1: Crear `frontend/src/pages/Coach.jsx`**

```jsx
import { useState } from 'react'
import { Dumbbell, Users, MessageSquare } from 'lucide-react'

import CoachRoutinesTab from '../components/coach/CoachRoutinesTab'
import CoachClientsTab from '../components/coach/CoachClientsTab'
import CoachRequestsTab from '../components/coach/CoachRequestsTab'

const TABS = [
  { key: 'rutinas', label: 'Rutinas', icon: Dumbbell },
  { key: 'clientes', label: 'Clientes', icon: Users },
  { key: 'solicitudes', label: 'Solicitudes', icon: MessageSquare },
]

export default function Coach() {
  const [tab, setTab] = useState('rutinas')

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">Coach</h1>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-white dark:bg-gray-900 text-brand-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'rutinas' && <CoachRoutinesTab />}
      {tab === 'clientes' && <CoachClientsTab />}
      {tab === 'solicitudes' && <CoachRequestsTab />}
    </div>
  )
}
```

- [ ] **Step 2: Crear `frontend/src/components/coach/CoachRoutinesTab.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Zap, Users, Share2, Calendar, Dumbbell } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'
import ShareLinkModal from './ShareLinkModal'

export default function CoachRoutinesTab() {
  const [routines, setRoutines] = useState([])
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(null)

  useEffect(() => {
    api.get('/coach/routines')
      .then((r) => setRoutines(r.data))
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Link to="/routines/generate?para=cliente"
          className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
          <Zap size={14} /> Generar
        </Link>
        <Link to="/routines/create?para=cliente"
          className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
          <Plus size={14} /> Manual
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="card text-center py-12">
          <Dumbbell size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 font-medium">Aun no tienes rutinas para clientes</p>
          <p className="text-gray-400 text-sm mt-1">
            Crea una y compartela con un enlace
          </p>
        </div>
      ) : (
        routines.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/routines/${r.id}`} className="flex-1 min-w-0">
                <h3 className="font-bold text-base truncate">{r.name}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-gray-400">
                  <span className="bg-brand-50 dark:bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full font-medium">
                    {r.split_type}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={10} /> {r.days_per_week} dias/sem
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} /> {r.clients_count} cliente{r.clients_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSharing(r)}
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3 flex-shrink-0"
              >
                <Share2 size={13} /> Compartir
              </button>
            </div>
          </div>
        ))
      )}

      {sharing && (
        <ShareLinkModal routine={sharing} onClose={() => setSharing(null)} />
      )}
    </div>
  )
}
```

**Importante:** el enlace `?para=cliente` requiere que `GenerateRoutine.jsx` y `CreateRoutine.jsx` lean ese parámetro y manden `is_template: true`. Hacerlo en este mismo paso:

En `frontend/src/pages/GenerateRoutine.jsx` y `frontend/src/pages/CreateRoutine.jsx`, agregar:

```jsx
import { useSearchParams } from 'react-router-dom'
// ...dentro del componente:
  const [searchParams] = useSearchParams()
  const paraCliente = searchParams.get('para') === 'cliente'
```

En `GenerateRoutine.jsx`, agregar `is_template: paraCliente` al cuerpo que se manda a `/ai/generate-routine`, y al terminar navegar a `/coach` en vez de `/routines/:id` cuando `paraCliente` sea true.

En `CreateRoutine.jsx`, cuando `paraCliente` sea true, cambiar el destino del POST de `/routines` a `/coach/routines` (el cuerpo es idéntico, `RoutineCreate`), y navegar a `/coach` al terminar.

- [ ] **Step 3: Crear `frontend/src/components/coach/ShareLinkModal.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { X, Copy, Check, Trash2, Eye, UserCheck } from 'lucide-react'

import api from '../../services/api'

const EXPIRACIONES = [
  { label: 'Nunca', value: null },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
]

export default function ShareLinkModal({ routine, onClose }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('personal')
  const [label, setLabel] = useState('')
  const [sinLimite, setSinLimite] = useState(false)
  const [maxClaims, setMaxClaims] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(null)

  const cargar = () => {
    api.get(`/coach/routines/${routine.id}/links`)
      .then((r) => setLinks(r.data))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [routine.id])

  const urlDe = (link) => `${window.location.origin}${link.path}`

  const crear = async () => {
    setCreating(true)
    setError('')
    try {
      await api.post(`/coach/routines/${routine.id}/links`, {
        kind,
        label: label.trim() || null,
        max_claims: kind === 'personal' ? 1 : (sinLimite ? null : Number(maxClaims)),
        expires_in_days: expiresInDays,
      })
      setLabel('')
      cargar()
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos crear el enlace')
    } finally {
      setCreating(false)
    }
  }

  const copiar = async (link) => {
    try {
      await navigator.clipboard.writeText(urlDe(link))
      setCopiado(link.id)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      setError('Tu navegador bloqueo el portapapeles. Copia el enlace a mano.')
    }
  }

  const revocar = async (link) => {
    if (!confirm('Desactivar este enlace? Quien ya lo reclamo conserva la rutina.')) return
    await api.delete(`/coach/links/${link.id}`)
    cargar()
  }

  const whatsapp = (link) =>
    `https://wa.me/?text=${encodeURIComponent(`Tu rutina: ${urlDe(link)}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={onClose}>
      <div className="card w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold truncate">Compartir rutina</h3>
            <p className="text-[11px] text-gray-400 truncate">{routine.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-lg text-xs mt-3">
            {error}
          </div>
        )}

        {/* Crear enlace */}
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setKind('personal'); setMaxClaims(1); setSinLimite(false) }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                kind === 'personal'
                  ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              Personal (1 persona)
            </button>
            <button
              onClick={() => setKind('plantilla')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                kind === 'plantilla'
                  ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              Plantilla (varias)
            </button>
          </div>

          <div>
            <label className="label">Nombre del enlace</label>
            <input className="input" value={label} maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Rutina de Juan — solo lo ves tu" />
          </div>

          {kind === 'plantilla' && (
            <div>
              <label className="label">Limite de personas</label>
              <div className="flex items-center gap-3">
                <input type="number" min={1} className="input flex-1" value={maxClaims}
                  disabled={sinLimite}
                  onChange={(e) => setMaxClaims(e.target.value)} />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={sinLimite}
                    onChange={(e) => setSinLimite(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500" />
                  Sin limite
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="label">Expira</label>
            <div className="flex gap-1.5">
              {EXPIRACIONES.map((e) => (
                <button key={e.label} onClick={() => setExpiresInDays(e.value)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    expiresInDays === e.value
                      ? 'border-brand-500 text-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={crear} className="btn-primary w-full text-sm" disabled={creating}>
            {creating ? 'Creando...' : 'Crear enlace'}
          </button>
        </div>

        {/* Enlaces existentes */}
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
            Enlaces
          </p>
          {loading ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-gray-400">Todavia no has creado ninguno.</p>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id}
                  className={`bg-gray-50 dark:bg-gray-800 rounded-xl p-3 ${l.revoked ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {l.label || (l.kind === 'personal' ? 'Enlace personal' : 'Plantilla')}
                        {l.revoked && ' · desactivado'}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{urlDe(l)}</p>
                    </div>
                    {!l.revoked && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => copiar(l)}
                          className="p-1.5 text-gray-400 hover:text-brand-500">
                          {copiado === l.id ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <a href={whatsapp(l)} target="_blank" rel="noreferrer"
                          className="p-1.5 text-gray-400 hover:text-green-500 text-[11px] font-bold">
                          WA
                        </a>
                        <button onClick={() => revocar(l)}
                          className="p-1.5 text-red-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><Eye size={10} /> {l.visits} aperturas</span>
                    <span className="flex items-center gap-1"><UserCheck size={10} /> {l.claims} reclamados</span>
                    {l.remaining !== null && <span>quedan {l.remaining}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Crear `frontend/src/components/coach/CoachClientsTab.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Users, AlertCircle, UserMinus } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

function fmtUltimo(iso) {
  if (!iso) return 'Nunca'
  const hoy = new Date()
  const d = new Date(`${iso}T00:00:00`)
  const dias = Math.round((hoy.setHours(0, 0, 0, 0) - d.getTime()) / 86400000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} dias`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}

export default function CoachClientsTab() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = () => {
    api.get('/coach/clients')
      .then((r) => setClients(r.data))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const quitarAcceso = async (c) => {
    if (!confirm(`Quitarle el acceso a ${c.name}? Su historial de entrenos no se borra.`)) return
    await api.delete(`/coach/assignments/${c.assignment_id}`)
    cargar()
  }

  if (loading) return <LoadingSpinner />

  if (clients.length === 0) {
    return (
      <div className="card text-center py-12">
        <Users size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 font-medium">Todavia no tienes clientes</p>
        <p className="text-gray-400 text-sm mt-1">
          Comparte el enlace de una rutina para que entren
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {clients.map((c) => (
        <div key={c.assignment_id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-sm truncate">{c.name}</h3>
              <p className="text-[11px] text-gray-400 truncate">{c.routine_name}</p>
            </div>
            <button onClick={() => quitarAcceso(c)}
              className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg flex-shrink-0">
              <UserMinus size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap text-[11px] text-gray-400">
            <span>Ultimo entreno: <b className="text-gray-600 dark:text-gray-300">{fmtUltimo(c.last_workout_date)}</b></span>
            <span>Esta semana: <b className="text-gray-600 dark:text-gray-300">{c.workouts_this_week} de {c.days_per_week}</b></span>
            {c.pending_requests > 0 && (
              <span className="flex items-center gap-1 text-amber-500 font-medium">
                <AlertCircle size={11} /> {c.pending_requests} solicitud{c.pending_requests !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Crear `frontend/src/components/coach/CoachRequestsTab.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { MessageSquare, Check, X, Users } from 'lucide-react'

import api from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

const ETIQUETAS = { pendiente: 'Pendiente', aceptada: 'Aceptada', rechazada: 'Rechazada' }

export default function CoachRequestsTab() {
  const [requests, setRequests] = useState([])
  const [routineCounts, setRoutineCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [replyFor, setReplyFor] = useState(null)
  const [reply, setReply] = useState('')

  const cargar = () => {
    Promise.all([
      api.get('/coach/change-requests'),
      api.get('/coach/routines').catch(() => ({ data: [] })),
    ])
      .then(([reqs, rutinas]) => {
        setRequests(reqs.data)
        const counts = {}
        rutinas.data.forEach((r) => { counts[r.id] = r.clients_count })
        setRoutineCounts(counts)
      })
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(cargar, [])

  const responder = async (req, status) => {
    await api.put(`/coach/change-requests/${req.id}`, { status, coach_reply: reply.trim() || null })
    setReplyFor(null)
    setReply('')
    cargar()
  }

  if (loading) return <LoadingSpinner />

  if (requests.length === 0) {
    return (
      <div className="card text-center py-12">
        <MessageSquare size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 font-medium">Sin solicitudes</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const usandola = routineCounts[r.routine_id] || 0
        return (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-sm truncate">{r.client_name}</h3>
                <p className="text-[11px] text-gray-400 truncate">
                  {r.routine_name}{r.exercise_name ? ` · ${r.exercise_name}` : ''}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                r.status === 'pendiente'
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              }`}>
                {ETIQUETAS[r.status] || r.status}
              </span>
            </div>

            <p className="text-sm mt-2.5 text-gray-700 dark:text-gray-300">{r.content}</p>

            {r.coach_reply && (
              <p className="text-xs mt-2 text-gray-500 border-l-2 border-brand-500 pl-2">
                {r.coach_reply}
              </p>
            )}

            {r.status === 'pendiente' && (
              <>
                {usandola > 1 && (
                  <div className="flex items-start gap-1.5 mt-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2.5 rounded-lg text-[11px]">
                    <Users size={13} className="flex-shrink-0 mt-0.5" />
                    <span>
                      Esta rutina la estan usando {usandola} personas. Si la editas, les cambia
                      a todas. Si el cambio es solo para {r.client_name}, arma una rutina aparte.
                    </span>
                  </div>
                )}

                {replyFor === r.id ? (
                  <div className="mt-3">
                    <textarea className="input h-20 resize-none" autoFocus value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Tu respuesta para el cliente" />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => responder(r, 'aceptada')}
                        className="btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1">
                        <Check size={13} /> Aceptar
                      </button>
                      <button onClick={() => responder(r, 'rechazada')}
                        className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1">
                        <X size={13} /> Rechazar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setReplyFor(r.id); setReply('') }}
                    className="btn-secondary w-full text-xs py-2 mt-3">
                    Responder
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Registrar la ruta protegida**

En `frontend/src/App.jsx`, agregar el import:

```jsx
import Coach from './pages/Coach'
```

Junto a `AdminRoute`, agregar:

```jsx
function CoachRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_coach && !user.is_admin) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}
```

Y la ruta, junto a las de admin:

```jsx
      <Route path="/coach" element={<CoachRoute><Coach /></CoachRoute>} />
```

- [ ] **Step 7: Verificar el panel**

Con sesión de `coach@test.com`:

1. Abrir `http://localhost:5173/coach` → se ven las tres pestañas
2. **Rutinas** → aparece la rutina de cliente con su conteo de clientes
3. **Compartir** → el modal abre; crear un enlace personal → aparece abajo con la URL, `0 aperturas`, `0 reclamados`, `quedan 1`
4. Tocar copiar → el ícono cambia a palomita; pegar la URL en otra pestaña y confirmar que carga la vista previa
5. Crear un enlace plantilla con límite 3 y expiración de 7 días → aparece con `quedan 3`
6. Abrir el enlace y reclamarlo desde otra sesión → volver al panel, refrescar: `1 aperturas`, `1 reclamados`, `quedan 2`
7. **Clientes** → aparece el cliente con su rutina, último entreno *Nunca*, `0 de N` esta semana
8. **Solicitudes** → aparece la que se mandó en la Task 14; responder aceptando → cambia a *Aceptada* con la respuesta abajo
9. Volver a **Clientes** → el contador de solicitudes pendientes bajó a cero

- [ ] **Step 8: Verificar el acceso**

Con sesión de `cliente@test.com`, abrir `http://localhost:5173/coach` → debe redirigir al dashboard.

- [ ] **Step 9: Verificar el aviso de alcance**

Reclamar la misma rutina plantilla con dos usuarios distintos, luego mandar una solicitud desde uno. En **Solicitudes** debe aparecer el aviso ámbar *"Esta rutina la estan usando 2 personas..."*.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/Coach.jsx frontend/src/components/coach/ frontend/src/pages/GenerateRoutine.jsx frontend/src/pages/CreateRoutine.jsx frontend/src/App.jsx
git commit -m "feat: panel de coach con rutinas, enlaces, clientes y solicitudes"
```

---

### Task 16: Acceso al panel y nombramiento de coaches

**Files:**
- Modify: `frontend/src/components/layout/TopBar.jsx`
- Modify: `frontend/src/pages/Admin.jsx`
- Modify: `backend/app/schemas/admin.py`
- Modify: `backend/app/routers/admin.py`
- Create: `backend/tests/test_admin_coach_flag.py`

**Interfaces:**
- Consumes: `is_coach` en `UserResponse` (Task 3)
- Produces: `AdminUserUpdate.is_coach: bool | None`; enlace a `/coach` en la barra superior

- [ ] **Step 1: Escribir la prueba que falla**

`backend/tests/test_admin_coach_flag.py`:

```python
from tests.conftest import make_user
from app.models.user import User


def test_admin_nombra_coach(client, db_session):
    admin = make_user(client, "ad1@test.com")
    db_session.query(User).filter(User.id == admin["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    otro = make_user(client, "ad1u@test.com")

    res = client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
                     json={"is_coach": True})
    assert res.status_code == 200
    assert res.json()["is_coach"] is True

    # Y ya puede entrar al panel
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 200


def test_admin_quita_el_rol(client, db_session):
    admin = make_user(client, "ad2@test.com")
    db_session.query(User).filter(User.id == admin["user"]["id"]).update({"is_admin": True})
    db_session.commit()
    otro = make_user(client, "ad2u@test.com")

    client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
               json={"is_coach": True})
    res = client.put(f"/admin/users/{otro['user']['id']}", headers=admin["headers"],
                     json={"is_coach": False})
    assert res.json()["is_coach"] is False
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 403


def test_un_no_admin_no_nombra_coaches(client):
    a = make_user(client, "ad3a@test.com")
    b = make_user(client, "ad3b@test.com")
    res = client.put(f"/admin/users/{b['user']['id']}", headers=a["headers"],
                     json={"is_coach": True})
    assert res.status_code == 403
```

- [ ] **Step 2: Ejecutar para confirmar que falla**

```bash
cd backend && python -m pytest tests/test_admin_coach_flag.py -v
```

Esperado: FAIL — `is_coach` se ignora y el usuario sigue recibiendo 403 en `/coach/routines`.

- [ ] **Step 3: Agregar el campo al schema de admin**

En `backend/app/schemas/admin.py`, en `AdminUserUpdate`, después de `is_admin`:

```python
    is_coach: bool | None = None
```

Revisar también `AdminUserListItem` y `AdminUserDetail` en ese archivo: si listan `is_admin`, agregarles `is_coach: bool = False` para que el panel pueda mostrar el estado sin una consulta extra.

- [ ] **Step 4: Aplicar el campo en el endpoint**

En `backend/app/routers/admin.py`, en `update_user` (línea 351), donde se aplican los campos de `AdminUserUpdate`. Si el código usa un bucle sobre los campos con `exclude_unset`, `is_coach` entra solo y no hay nada que hacer; verificarlo. Si los campos se asignan uno por uno, agregar:

```python
    if data.is_coach is not None:
        user.is_coach = data.is_coach
```

- [ ] **Step 5: Ejecutar las pruebas**

```bash
cd backend && python -m pytest tests/test_admin_coach_flag.py -v
```

Esperado: los 3 en PASS.

- [ ] **Step 6: Enlace al panel en la barra superior**

En `frontend/src/components/layout/TopBar.jsx`, junto al bloque de `user?.is_admin` (línea 39), agregar:

```jsx
          {(user?.is_coach || user?.is_admin) && (
            <Link
              to="/coach"
              className="p-2 text-gray-400 hover:text-brand-500 transition-colors"
              title="Panel de coach"
            >
              <Users size={20} />
            </Link>
          )}
```

Agregar `Users` al import de lucide-react del archivo.

- [ ] **Step 7: Interruptor en el panel Admin**

En `frontend/src/pages/Admin.jsx`, en el formulario de edición de usuario, junto al control que maneja `is_admin`, agregar el equivalente para `is_coach`:

```jsx
              <label className="flex items-center gap-2 cursor-pointer select-none mt-2">
                <input
                  type="checkbox"
                  checked={!!editUser.is_coach}
                  onChange={(e) => setEditUser({ ...editUser, is_coach: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Coach — puede crear rutinas y compartirlas
                </span>
              </label>
```

Adaptar los nombres `editUser` / `setEditUser` a los que use realmente ese formulario, y asegurarse de que `is_coach` viaje en el cuerpo del `PUT /admin/users/{id}`.

- [ ] **Step 8: Ejecutar todo el backend**

```bash
cd backend && python -m pytest tests/ -v
```

Esperado: todo en PASS.

- [ ] **Step 9: Verificar de punta a punta**

1. Con sesión de admin, ir a **Admin**, abrir un usuario, activar **Coach**, guardar
2. Cerrar sesión y entrar con ese usuario → aparece el ícono de personas en la barra superior
3. Tocarlo → abre `/coach`
4. Con un usuario sin el rol, el ícono no aparece y `/coach` redirige al dashboard

- [ ] **Step 10: Recorrido completo final**

El camino entero, de una sentada, en una base limpia:

1. Admin marca a Josué como coach
2. Josué entra a `/coach`, genera una rutina para clientes
3. Crea un enlace personal con expiración de 30 días
4. Copia el enlace y lo abre en incógnito
5. Se ve la vista previa sin ejercicios
6. **Crear cuenta** → registro → **Ver mi rutina** → **Agregar a mis rutinas**
7. Aterriza en la rutina, marcada *"Rutina de tu coach · Josué"*, sin controles de edición
8. Marca un ejercicio como hecho, recarga: sigue marcado
9. Pide un cambio en un ejercicio
10. Josué recibe la notificación, entra a **Solicitudes**, responde aceptando
11. Josué renombra la rutina desde `/routines/{id}`
12. El cliente recibe *"Josué actualizo ..."* y ve el nombre nuevo
13. Josué entra a **Clientes**, ve la adherencia, le quita el acceso
14. El cliente ya no ve la rutina, pero su historial de entrenos sigue en **Progreso**

- [ ] **Step 11: Commit**

```bash
git add backend/app/schemas/admin.py backend/app/routers/admin.py backend/tests/test_admin_coach_flag.py frontend/src/components/layout/TopBar.jsx frontend/src/pages/Admin.jsx
git commit -m "feat: nombrar coaches desde admin y acceso al panel"
```

---

## Cobertura del spec

| Requisito del spec | Tarea |
|---|---|
| `users.is_coach`, `routines.is_template` | 3 |
| `routine_share_links` | 3 |
| `routine_assignments` con UNIQUE | 3 |
| `share_link_visits` | 3 |
| `routine_change_requests` | 3 |
| Migraciones sin Alembic | 3 |
| `get_readable_routine` y compañía | 5 |
| Tabla de permisos (dueño / asignado / extraño) | 5, 6 |
| Cierre del hueco de `/workouts/progress` | 5 |
| `GET /routines` con asignadas, `read_only`, `assigned_by` | 6 |
| Endpoints de escritura sin cambios | 5 (probado), 6 |
| Vista previa pública sin ejercicios | 8 |
| Estados `valido`/`revocado`/`expirado`/`lleno`/`no_existe` | 8 |
| Reclamo idempotente | 8 |
| Cupos cuentan asignaciones activas; revocar libera | 8, 10 |
| Coach no reclama su propio enlace | 8 |
| Sólo se comparten rutinas `is_template` | 7 |
| Enlace personal fuerza `max_claims = 1` | 7 |
| Expiración, límite, revocar, ver quién abrió | 7 |
| Panel: pestaña Rutinas | 7 (API), 15 (UI) |
| Creación reutiliza el generador, sin `user_data` del coach | 7 |
| Panel: pestaña Clientes con adherencia | 10 (API), 15 (UI) |
| Panel: pestaña Solicitudes | 9 (API), 15 (UI) |
| Aviso de alcance ("N personas usan esta rutina") | 15 |
| Quitar acceso conserva el historial | 10 |
| Aislamiento entre coaches | 7, 9, 10 |
| Interruptor `is_coach` en Admin | 16 |
| Pantalla pública `/r/:token` | 12 |
| `?redirect=` en Login y Register | 13 |
| Respaldo en `sessionStorage` | 12, 13 |
| Vista de solo lectura del cliente | 14 |
| Modal de solicitud de cambio | 14 |
| Las 4 notificaciones | 11 |
| Los 12 casos de prueba del spec | 2, 5, 6, 7, 8, 9, 10, 11 |

Fuera de alcance, como dice el spec: QR, cobros, chat coach-cliente, plantillas de fábrica, edición por el cliente.
