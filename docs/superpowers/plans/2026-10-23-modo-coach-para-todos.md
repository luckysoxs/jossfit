# Modo coach para todos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier usuario registrado pueda pasar rutinas a otras personas, y que un administrador pueda quitarle esa posibilidad a alguien en concreto.

**Architecture:** Se invierte la bandera: en vez de `is_coach` ("puedes si te lo dieron"), una columna nueva `coach_blocked` ("puedes, salvo que te lo hayan quitado"). El guardia del backend y las tres puertas del frontend pasan a leer esa columna.

**Tech Stack:** FastAPI + SQLAlchemy 2 (backend, pytest con SQLite en memoria), React + Vite + Tailwind (frontend, vitest + Testing Library).

Spec: `docs/superpowers/specs/2026-10-23-modo-coach-para-todos-design.md`

## Global Constraints

- Columna nueva `coach_blocked`, booleana, por omision falso.
- La regla de acceso es: pasa cualquier usuario autenticado, salvo que
  `coach_blocked` sea verdadero. **Un administrador pasa siempre**, aunque
  tenga la bandera puesta.
- Mensaje de rechazo, exacto: `"Un administrador desactivo tu modo coach"`.
- A un usuario bloqueado solo se le cierran las rutinas de clientes: duplicar
  con `destino="mia"` sigue funcionando.
- `is_coach` se queda en la base y en los schemas, pero **nada vuelve a leerla
  para decidir acceso**. No se borra la columna.
- El menu del frontend se llama **"Modo coach"**.
- El panel de admin pasa de "Hacer Coach / Quitar rol de Coach" a
  "Bloquear modo coach / Desbloquear modo coach", y la etiqueta morada "Coach"
  se vuelve una roja **"Coach bloqueado"** que solo aparece cuando lo esta.
- Comentarios e identificadores en espanol sin acentos; textos de interfaz en
  espanol.
- Comandos backend desde `fitness-app/backend`: `venv/Scripts/python -m pytest ...`
- Comandos frontend desde `fitness-app/frontend`: `npm test`, `npm run build`.

---

### Task 1: Backend — la bandera se invierte

**Files:**
- Modify: `backend/app/models/user.py` (columna nueva junto a `is_coach`)
- Modify: `backend/app/main.py` (una sentencia en la lista de migraciones)
- Modify: `backend/app/auth/security.py` (`get_coach_user`)
- Modify: `backend/app/routers/routines.py` (`duplicate_routine`)
- Modify: `backend/app/schemas/user.py` (`UserResponse`)
- Modify: `backend/app/schemas/admin.py` (`AdminUserListItem`, `AdminUserUpdate`)
- Modify: `backend/app/routers/admin.py` (pasar `coach_blocked` al armar la lista)
- Test: `backend/tests/test_coach_para_todos.py`

**Interfaces:**
- Produces: `User.coach_blocked: bool`; `UserResponse.coach_blocked: bool`;
  `AdminUserUpdate.coach_blocked: bool | None`;
  `AdminUserListItem.coach_blocked: bool`. El frontend (Task 2) lee
  `coach_blocked` de `GET /auth/me` y lo escribe con
  `PUT /admin/users/{id}`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_coach_para_todos.py`:

```python
from tests.conftest import make_user
from app.models.user import User


def _bloquear(db_session, user_id, valor=True):
    db_session.query(User).filter(User.id == user_id).update({"coach_blocked": valor})
    db_session.commit()


def _hacer_admin(db_session, user_id):
    db_session.query(User).filter(User.id == user_id).update({"is_admin": True})
    db_session.commit()


def _crear_rutina_propia(client, headers, name="Mia"):
    res = client.post("/routines", headers=headers, json={
        "name": name, "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 1,
        "days": [{"day_number": 1, "name": "Pecho", "focus": "chest", "exercises": []}],
    })
    assert res.status_code == 201, res.text
    return res.json()["id"]


MENSAJE = "Un administrador desactivo tu modo coach"


def test_usuario_recien_registrado_entra_al_panel(client):
    """Sin ninguna bandera: el modo coach es de todos."""
    u = make_user(client, "coach1@test.com")

    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 200, res.text
    assert res.json() == []


def test_usuario_normal_crea_rutina_de_cliente_y_enlace(client):
    u = make_user(client, "coach2@test.com")

    res = client.post("/coach/routines", headers=u["headers"], json={
        "name": "Para mi primo", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 201, res.text
    rid = res.json()["id"]
    assert res.json()["is_template"] is True

    res = client.post(f"/coach/routines/{rid}/links", headers=u["headers"],
                      json={"kind": "personal"})
    assert res.status_code == 201, res.text
    assert res.json()["token"]


def test_usuario_normal_duplica_hacia_clientes(client, db_session):
    u = make_user(client, "coach3@test.com")
    rid = _crear_rutina_propia(client, u["headers"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is True


def test_bloqueado_no_entra_al_panel(client, db_session):
    u = make_user(client, "coach4@test.com")
    _bloquear(db_session, u["user"]["id"])

    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 403
    assert res.json()["detail"] == MENSAJE

    res = client.post("/coach/routines", headers=u["headers"], json={
        "name": "Nada", "split_type": "full_body",
        "objective": "hypertrophy", "days_per_week": 3, "days": [],
    })
    assert res.status_code == 403


def test_bloqueado_no_duplica_hacia_clientes(client, db_session):
    u = make_user(client, "coach5@test.com")
    rid = _crear_rutina_propia(client, u["headers"])
    _bloquear(db_session, u["user"]["id"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 403
    assert res.json()["detail"] == MENSAJE


def test_bloqueado_si_duplica_para_si_mismo(client, db_session):
    """El bloqueo es solo para rutinas de clientes."""
    u = make_user(client, "coach6@test.com")
    rid = _crear_rutina_propia(client, u["headers"])
    _bloquear(db_session, u["user"]["id"])

    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "mia"})
    assert res.status_code == 201, res.text
    assert res.json()["is_template"] is False


def test_admin_bloqueado_sigue_entrando(client, db_session):
    """Un admin no puede dejarse fuera del panel por error."""
    u = make_user(client, "coach7@test.com")
    _hacer_admin(db_session, u["user"]["id"])
    _bloquear(db_session, u["user"]["id"])

    assert client.get("/coach/routines", headers=u["headers"]).status_code == 200

    rid = _crear_rutina_propia(client, u["headers"])
    res = client.post(f"/routines/{rid}/duplicate", headers=u["headers"],
                      json={"destino": "cliente"})
    assert res.status_code == 201, res.text


def test_me_expone_coach_blocked(client, db_session):
    u = make_user(client, "coach8@test.com")

    res = client.get("/auth/me", headers=u["headers"])
    assert res.status_code == 200
    assert res.json()["coach_blocked"] is False

    _bloquear(db_session, u["user"]["id"])
    res = client.get("/auth/me", headers=u["headers"])
    assert res.json()["coach_blocked"] is True


def test_admin_bloquea_y_desbloquea(client, db_session):
    admin = make_user(client, "coach9a@test.com")
    _hacer_admin(db_session, admin["user"]["id"])
    otro = make_user(client, "coach9b@test.com")
    uid = otro["user"]["id"]

    res = client.put(f"/admin/users/{uid}", headers=admin["headers"],
                     json={"coach_blocked": True})
    assert res.status_code == 200, res.text
    assert res.json()["coach_blocked"] is True
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 403

    res = client.put(f"/admin/users/{uid}", headers=admin["headers"],
                     json={"coach_blocked": False})
    assert res.status_code == 200, res.text
    assert res.json()["coach_blocked"] is False
    assert client.get("/coach/routines", headers=otro["headers"]).status_code == 200


def test_un_usuario_normal_no_bloquea_a_nadie(client):
    uno = make_user(client, "coach10a@test.com")
    dos = make_user(client, "coach10b@test.com")

    res = client.put(f"/admin/users/{dos['user']['id']}", headers=uno["headers"],
                     json={"coach_blocked": True})
    assert res.status_code == 403
    assert client.get("/coach/routines", headers=dos["headers"]).status_code == 200


def test_la_lista_de_admin_trae_coach_blocked(client, db_session):
    admin = make_user(client, "coach11a@test.com")
    _hacer_admin(db_session, admin["user"]["id"])
    otro = make_user(client, "coach11b@test.com")
    _bloquear(db_session, otro["user"]["id"])

    res = client.get("/admin/users", headers=admin["headers"])
    assert res.status_code == 200, res.text
    por_correo = {u["email"]: u for u in res.json()["users"]}
    assert por_correo["coach11b@test.com"]["coach_blocked"] is True
    assert por_correo["coach11a@test.com"]["coach_blocked"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `venv/Scripts/python -m pytest tests/test_coach_para_todos.py -v`
Expected: FAIL. Varios casos revientan con `OperationalError`/`InvalidRequestError` porque `coach_blocked` no existe como columna, y los de acceso devuelven 403 con el mensaje viejo ("Necesitas ser coach para entrar aqui") en vez de 200.

- [ ] **Step 3: Add the column and the migration**

En `backend/app/models/user.py`, junto a `is_coach`:

```python
    # is_coach quedo sin uso: el modo coach es de todos. Lo que decide el
    # acceso es coach_blocked, que un administrador prende para quitarselo a
    # alguien en concreto.
    coach_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
```

En `backend/app/main.py`, en la lista de sentencias de migracion, junto a la de
`is_coach`:

```python
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_blocked BOOLEAN DEFAULT FALSE",
```

- [ ] **Step 4: Flip the guard**

En `backend/app/auth/security.py`, reemplazar el cuerpo de `get_coach_user`:

```python
def get_coach_user(
    user: User = Depends(get_current_user),
) -> User:
    """El modo coach es de todos: solo se rechaza a quien lo tiene bloqueado.

    Un admin pasa siempre, aunque traiga la bandera puesta, para que no pueda
    dejarse fuera del panel por error.
    """
    if user.coach_blocked and not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Un administrador desactivo tu modo coach",
        )
    return user
```

En `backend/app/routers/routines.py`, dentro de `duplicate_routine`, cambiar:

```python
    para_cliente = data.destino == "cliente"
    if para_cliente and not (user.is_coach or user.is_admin):
        raise HTTPException(
            status_code=403,
            detail="Necesitas ser coach para crear rutinas de clientes",
        )
```

por:

```python
    para_cliente = data.destino == "cliente"
    if para_cliente and user.coach_blocked and not user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Un administrador desactivo tu modo coach",
        )
```

- [ ] **Step 5: Expose the field in the schemas**

En `backend/app/schemas/user.py`, en `UserResponse`, debajo de `is_coach`:

```python
    coach_blocked: bool = False
```

En `backend/app/schemas/admin.py`, en `AdminUserListItem`, debajo de
`is_coach`:

```python
    coach_blocked: bool = False
```

y en `AdminUserUpdate`, debajo de `is_coach`:

```python
    coach_blocked: bool | None = None
```

En `backend/app/routers/admin.py`, donde se arma cada `AdminUserListItem`
(junto a `is_admin=u.is_admin`), agregar:

```python
                coach_blocked=u.coach_blocked,
```

- [ ] **Step 6: Retire the two tests that encode the old rule**

Dos archivos existentes dan por hecho que sin `is_coach` no se entra, asi que
fallan a proposito con el criterio nuevo. Hay que atenderlos, no ignorarlos.

**`backend/tests/test_auth_deps.py`**: reemplazar `test_no_coach_recibe_403`
(ya no hay tal cosa como "no coach") por el caso del bloqueo, y dejar los
otros tres casos del archivo intactos:

```python
def test_bloqueado_recibe_403(client, db_session):
    u = make_user(client, "nocoach@test.com")
    db_session.query(User).filter(User.id == u["user"]["id"]).update({"coach_blocked": True})
    db_session.commit()
    res = client.get("/coach/routines", headers=u["headers"])
    assert res.status_code == 403
    assert "coach" in res.json()["detail"].lower()
```

`test_coach_entra` se queda tal cual: pone `is_coach=True`, que ahora no hace
nada, y sigue esperando 200. Es correcto y de paso prueba que la bandera vieja
ya no estorba.

**`backend/tests/test_admin_coach_flag.py`**: borrar el archivo completo.
Sus tres casos tratan de dar y quitar el rol `is_coach`, que ya no gobierna el
acceso; `test_admin_quita_el_rol` afirma un 403 que con la regla nueva no
ocurre. Lo que si importa de ese archivo (que un admin bloquee y desbloquee, y
que un no admin no pueda) ya esta cubierto en
`test_coach_para_todos.py::test_admin_bloquea_y_desbloquea` y
`::test_un_usuario_normal_no_bloquea_a_nadie`.

```bash
git rm backend/tests/test_admin_coach_flag.py
```

- [ ] **Step 7: Run the new tests and the full suite**

Run: `venv/Scripts/python -m pytest tests/test_coach_para_todos.py tests/test_auth_deps.py -v`
Expected: 11 + 4 = 15 passed

Run: `venv/Scripts/python -m pytest -q`
Expected: todo en verde. Si alguna otra prueba falla por el criterio nuevo,
arreglarla sin aflojar lo que verifica y decir en el reporte cual y por que.

- [ ] **Step 8: Commit**

```bash
git add -A backend
git commit -m "feat: el modo coach es de todos, salvo que un admin lo bloquee"
```

---

### Task 2: Frontend — las tres puertas y el panel de admin

**Files:**
- Modify: `frontend/src/App.jsx` (`CoachRoute`, lineas 51-57)
- Modify: `frontend/src/components/layout/TopBar.jsx` (lineas 39-47)
- Modify: `frontend/src/pages/RoutineDetail.jsx` (linea 26)
- Modify: `frontend/src/pages/Admin.jsx` (`toggleCoach`, la etiqueta y el boton)
- Test: `frontend/src/pages/RoutineDetail.test.jsx` (archivo existente)

**Interfaces:**
- Consumes: `user.coach_blocked` de `GET /auth/me` (Task 1) y
  `PUT /admin/users/{id}` con `{ coach_blocked: boolean }`.

- [ ] **Step 1: Write the failing test**

En `frontend/src/pages/RoutineDetail.test.jsx`, el mock de `useAuth` hoy es fijo
(`{ id: 1, is_coach: false, is_admin: false }`). Hacerlo variable y agregar un
bloque nuevo.

Reemplazar el mock:

```jsx
let usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: false }

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: usuario }),
}))
```

Y agregar al final del archivo:

```jsx
describe('RoutineDetail - compartir con clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: false }
  })

  it('un usuario normal puede compartir con clientes', async () => {
    await montar()
    expect(await screen.findByRole('button', { name: /Compartir con clientes/i })).toBeInTheDocument()
  })

  it('un usuario bloqueado no ve el boton', async () => {
    usuario = { id: 1, is_coach: false, is_admin: false, coach_blocked: true }
    await montar()

    expect(await screen.findByText(/Pecho/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Compartir con clientes/i })).toBeNull()
  })

  it('un admin bloqueado si lo ve', async () => {
    usuario = { id: 1, is_coach: false, is_admin: true, coach_blocked: true }
    await montar()
    expect(await screen.findByRole('button', { name: /Compartir con clientes/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDetail.test.jsx`
Expected: FAIL en el primer caso nuevo
(`Unable to find role="button" and name /Compartir con clientes/i`), porque hoy
ese boton pide `is_coach`. Los casos que ya estaban deben seguir pasando.

- [ ] **Step 3: Open the three doors**

En `frontend/src/App.jsx`, en `CoachRoute`:

```jsx
  if (user.coach_blocked && !user.is_admin) return <Navigate to="/" replace />
```

En `frontend/src/components/layout/TopBar.jsx`, la condicion y la etiqueta del
enlace (es un enlace de solo icono: su nombre vive en `aria-label`, y `title`
lo muestra al pasar el mouse):

```jsx
          {(!user?.coach_blocked || user?.is_admin) && (
            <Link
              to="/coach"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-brand-500"
              aria-label="Modo coach"
              title="Modo coach"
            >
              <Users size={20} />
            </Link>
          )}
```

En `frontend/src/pages/RoutineDetail.jsx`, linea 26:

```jsx
  // El modo coach es de todos: solo se le esconde a quien lo tiene bloqueado.
  const puedeCompartirClientes = !!(!user?.coach_blocked || user?.is_admin)
    && !readOnly && routine && !routine.is_template
```

- [ ] **Step 4: Rename the heading of the coach page**

En `frontend/src/pages/Coach.jsx`, linea 19:

```jsx
      <h1 className="text-xl sm:text-2xl font-bold">Modo coach</h1>
```

- [ ] **Step 5: Flip the admin switch**

En `frontend/src/pages/Admin.jsx`, reemplazar `toggleCoach`:

```jsx
  const toggleCoachBlocked = async () => {
    try {
      await api.put(`/admin/users/${userId}`, { coach_blocked: !detail.user.coach_blocked })
      setDetail({ ...detail, user: { ...detail.user, coach_blocked: !detail.user.coach_blocked } })
      onRefresh()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error')
    }
  }
```

La etiqueta junto al nombre (donde hoy dice `user.is_coach && ... Coach`):

```jsx
                {user.coach_blocked && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Coach bloqueado</span>}
```

Y el boton del bloque "Coach role":

```jsx
              {/* Modo coach: es de todos, esto solo sirve para quitarselo */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={toggleCoachBlocked} className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl font-medium text-sm transition-colors ${
                  user.coach_blocked
                    ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-500 hover:bg-purple-100'
                    : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 hover:bg-yellow-100'
                }`}>
                  <Users size={16} />
                  {user.coach_blocked ? 'Desbloquear modo coach' : 'Bloquear modo coach - ya no podra pasar rutinas'}
                </button>
              </div>
```

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run --config vitest.config.js src/pages/RoutineDetail.test.jsx`
Expected: los casos que ya estaban mas los 3 nuevos, todos en verde.

Run: `npm test`
Expected: todo en verde.

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/layout/TopBar.jsx frontend/src/pages/RoutineDetail.jsx frontend/src/pages/RoutineDetail.test.jsx frontend/src/pages/Coach.jsx frontend/src/pages/Admin.jsx
git commit -m "feat: modo coach visible para todos y bloqueo desde el panel de admin"
```
