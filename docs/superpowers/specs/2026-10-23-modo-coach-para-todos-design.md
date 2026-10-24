# Modo coach para todos los usuarios

Fecha: 2026-10-23

## Problema

Pasar una rutina a otra persona exige el permiso `is_coach`, que solo un
administrador puede dar desde el panel de admin. Cualquier usuario registrado
deberia poder hacerlo sin pedir permiso.

La bandera se revisa en siete lugares: `get_coach_user`
(`auth/security.py:71`), el endpoint de duplicar hacia clientes
(`routers/routines.py:702`), la ruta `/coach` (`App.jsx:55`), el menu
(`TopBar.jsx:39`), el boton "Compartir con clientes" (`RoutineDetail.jsx:26`),
y el interruptor y la etiqueta del panel de admin (`Admin.jsx:68,123,173`).

## Solucion

Invertir la bandera: en vez de "puedes si te lo dieron", la regla pasa a ser
"puedes, salvo que un administrador te lo haya quitado".

**Por que no rellenar `is_coach`:** el proyecto no tiene tabla de migraciones;
`main.py` corre una lista de sentencias idempotentes en cada arranque
(`main.py:144`). Un `UPDATE users SET is_coach = TRUE` se ejecutaria en cada
despliegue y volveria a habilitar a quien un administrador hubiera bloqueado,
dejando el interruptor sin efecto. Una columna nueva que nace en falso no
necesita relleno y un bloqueo se queda puesto.

### Backend

**Modelo** (`models/user.py`): columna nueva

```python
coach_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Migracion** (`main.py`, en la lista de sentencias):

```
"ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_blocked BOOLEAN DEFAULT FALSE"
```

**Guardia** (`auth/security.py`, `get_coach_user`): deja pasar a todo usuario
autenticado y rechaza solo al bloqueado, con 403 y
`detail="Un administrador desactivo tu modo coach"`. Un administrador pasa
siempre, aunque tenga la bandera puesta, para no poder dejarse fuera del panel
por error.

**Duplicar hacia clientes** (`routers/routines.py`, `duplicate_routine`): la
condicion `para_cliente and not (user.is_coach or user.is_admin)` pasa a
`para_cliente and user.coach_blocked and not user.is_admin`, con el mismo
`detail` que el guardia.

**Schemas:**
- `schemas/user.py` (`UserResponse`): se agrega `coach_blocked: bool = False`,
  para que el frontend sepa a quien esconderle el modo coach. Se conserva
  `is_coach` en la respuesta: ya no gobierna nada, pero quitarlo romperia a
  quien tenga la app vieja abierta.
- `schemas/admin.py`: `AdminUserListItem` y `AdminUserUpdate` agregan
  `coach_blocked`. `is_coach` se queda en los dos, sin uso.

**La columna `is_coach` se queda en la base y en los schemas, sin leerse para
decidir acceso.** Borrar una columna no se puede deshacer y no estorba.

### Frontend

- `components/layout/TopBar.jsx`: la entrada del menu se llama **"Modo coach"**
  y se muestra cuando `!user?.coach_blocked || user?.is_admin`.
- `App.jsx`: la ruta `/coach` redirige a la raiz solo si
  `user.coach_blocked && !user.is_admin`.
- `pages/RoutineDetail.jsx`: `puedeCompartirClientes` deja de pedir
  `is_coach || is_admin` y pasa a pedir `!user?.coach_blocked || user?.is_admin`,
  conservando el resto de la condicion (rutina propia, no plantilla, no de solo
  lectura).
- `pages/Admin.jsx`: el interruptor "Hacer Coach / Quitar rol de Coach" pasa a
  "Bloquear modo coach / Desbloquear modo coach" y escribe `coach_blocked`. La
  etiqueta morada "Coach" de la lista se cambia por una roja **"Coach
  bloqueado"**, que solo aparece cuando el usuario lo esta.

### Pruebas

**`backend/tests/test_coach_para_todos.py`**

- Un usuario recien registrado, sin ninguna bandera, entra a
  `GET /coach/routines`, crea una rutina de cliente con `POST /coach/routines`
  y le genera un enlace.
- Ese mismo usuario duplica una rutina propia con `destino="cliente"` y recibe
  201.
- Un usuario con `coach_blocked=True` recibe 403 en `GET /coach/routines`,
  `POST /coach/routines` y en duplicar con `destino="cliente"`, y el `detail`
  es "Un administrador desactivo tu modo coach".
- Ese usuario bloqueado si puede duplicar con `destino="mia"`: el bloqueo es
  solo para rutinas de clientes.
- Un administrador con `coach_blocked=True` entra al panel igual.
- `PUT /admin/users/{id}` con `{"coach_blocked": true}` bloquea, y con `false`
  desbloquea; un usuario que no es admin recibe 403 al intentarlo.

**`frontend/src/pages/RoutineDetail.test.jsx`** (archivo existente)

- El boton "Compartir con clientes" aparece para un usuario normal sin
  banderas. Hoy el mock de `useAuth` devuelve `is_coach: false`, asi que esta
  prueba cambia de sentido con el nuevo criterio.
- No aparece para un usuario con `coach_blocked: true`.

## Fuera de alcance

- Quitar la columna `is_coach` de la base.
- Limitar cuantos clientes puede tener un usuario.
- Avisarle al usuario que su modo coach fue bloqueado: se entera al entrar.
