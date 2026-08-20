# Rutinas de coach compartidas por enlace

**Fecha:** 2026-08-20
**Estado:** Diseño aprobado

## Problema

Josué entrena clientes. Hoy JOSSFITness sólo permite que cada usuario cree rutinas
para sí mismo: `Routine.user_id` es dueño y entrenador a la vez, y todos los
endpoints de rutina filtran por ese campo. No hay forma de que un entrenador
arme una rutina y se la entregue a otra persona.

Se necesita que un coach cree rutinas, genere un enlace, lo mande por WhatsApp o
historias, y que quien lo abra entre a verla desde su cuenta — registrándose
primero si no tiene.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Tipo de enlace | Los dos: personal (1 cliente) y plantilla (varios) |
| Al reclamar | La rutina queda **vinculada al coach**, no se copia. El coach edita, el cliente ve el cambio |
| Rol de coach | Campo nuevo `users.is_coach` desde ahora, para poder nombrar otros entrenadores |
| Permisos del cliente | Entrenar + pedir cambios. No puede editar la rutina |
| Control del enlace | Revocar, expiración, límite de personas, y ver quién lo abrió |
| Panel de coach | Adherencia básica por cliente |

## Enfoque

Una capa nueva encima de lo que ya existe, sin reescribir nada de rutinas.

Dos propiedades del código actual hacen que esto sea barato y seguro:

1. **Todos los endpoints de escritura de `routines.py` ya filtran por
   `Routine.user_id == user.id`.** Un cliente con acceso de lectura a la rutina
   del coach recibe 404 en todos ellos sin escribir una línea de código nuevo.
   Es la garantía central del diseño: no depende de que se recuerde proteger
   cada endpoint.
2. **`routine_progress` ya está llaveado por `(user_id, routine_id, date)`.**
   Varios clientes entrenando la misma rutina del coach llevan progreso separado
   desde el primer día.

Se descartaron dos alternativas:

- **Copiar la rutina a la cuenta del cliente.** Más simple, pero el coach pierde
  la rutina de vista en cuanto la entrega: editarla ya no llega al cliente.
- **Permitir que el cliente adapte la rutina** (overrides por usuario). Requiere
  una tabla de sobreescrituras y complica cada lectura de rutina. No es lo que
  un cliente de coach espera.

## Modelo de datos

Todas las migraciones se aplican con el patrón de `run_migrations()` en
`app/main.py` (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`), no
con Alembic, siguiendo lo que ya hace el proyecto.

### Columnas nuevas

```sql
ALTER TABLE users    ADD COLUMN IF NOT EXISTS is_coach    BOOLEAN DEFAULT FALSE;
ALTER TABLE routines ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;
```

- `users.is_coach` — el rol. Se activa desde el panel Admin.
- `routines.is_template` — marca una rutina como "para clientes". Estas rutinas
  **no** aparecen en la lista de entrenamiento propia del coach; viven en el
  panel de coach. Sin esta separación, las rutinas de clientes se mezclarían con
  las suyas.

### `routine_share_links`

```sql
CREATE TABLE IF NOT EXISTS routine_share_links (
    id          SERIAL PRIMARY KEY,
    token       VARCHAR(32) UNIQUE NOT NULL,
    routine_id  INTEGER REFERENCES routines(id) ON DELETE CASCADE,
    coach_id    INTEGER REFERENCES users(id)    ON DELETE CASCADE,
    kind        VARCHAR(10) NOT NULL,          -- 'personal' | 'plantilla'
    label       VARCHAR(100),                  -- nombre interno, sólo lo ve el coach
    max_claims  INTEGER,                       -- NULL = ilimitado; personal = 1
    expires_at  TIMESTAMP,                     -- NULL = nunca expira
    revoked     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rsl_token    ON routine_share_links(token);
CREATE INDEX IF NOT EXISTS idx_rsl_coach    ON routine_share_links(coach_id);
CREATE INDEX IF NOT EXISTS idx_rsl_routine  ON routine_share_links(routine_id);
```

`token` se genera con `secrets.token_urlsafe(16)` — 22 caracteres, no adivinable.

**Sólo se pueden compartir rutinas con `is_template = true`.** Crear un enlace
sobre una rutina personal del coach devuelve 400. Sin esta regla, el coach
podría entregar por accidente la rutina que él mismo entrena, y quedaría
expuesta a los avisos de "N personas están usando esta rutina" cada vez que la
edita para sí mismo.

### `routine_assignments`

```sql
CREATE TABLE IF NOT EXISTS routine_assignments (
    id          SERIAL PRIMARY KEY,
    routine_id  INTEGER REFERENCES routines(id)            ON DELETE CASCADE,
    client_id   INTEGER REFERENCES users(id)               ON DELETE CASCADE,
    coach_id    INTEGER REFERENCES users(id)               ON DELETE CASCADE,
    link_id     INTEGER REFERENCES routine_share_links(id) ON DELETE SET NULL,
    status      VARCHAR(10) DEFAULT 'active',   -- 'active' | 'revoked'
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(routine_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ra_client ON routine_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_ra_coach  ON routine_assignments(coach_id);
```

El `UNIQUE(routine_id, client_id)` es lo que hace idempotente el reclamo.
`status = 'revoked'` quita el acceso sin borrar el historial de la relación.

### `share_link_visits`

```sql
CREATE TABLE IF NOT EXISTS share_link_visits (
    id         SERIAL PRIMARY KEY,
    link_id    INTEGER REFERENCES routine_share_links(id) ON DELETE CASCADE,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = sin sesión
    claimed    BOOLEAN DEFAULT FALSE,
    visited_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slv_link ON share_link_visits(link_id);
```

Append-only. Las aperturas se cuentan agregando; los reclamos se cuentan desde
`routine_assignments`, que es la fuente de verdad.

### `routine_change_requests`

```sql
CREATE TABLE IF NOT EXISTS routine_change_requests (
    id                  SERIAL PRIMARY KEY,
    assignment_id       INTEGER REFERENCES routine_assignments(id) ON DELETE CASCADE,
    client_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
    routine_exercise_id INTEGER REFERENCES routine_exercises(id) ON DELETE SET NULL,
    content             TEXT NOT NULL,
    status              VARCHAR(15) DEFAULT 'pendiente',  -- 'pendiente' | 'aceptada' | 'rechazada'
    coach_reply         TEXT,
    created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rcr_assignment ON routine_change_requests(assignment_id);
CREATE INDEX IF NOT EXISTS idx_rcr_status     ON routine_change_requests(status);
```

No se reutiliza la tabla `suggestions`: esa es feedback de la app hacia admin,
sin contexto de rutina ni de ejercicio.

## Control de acceso

Un único helper nuevo, `app/services/routine_access.py`:

```python
def get_readable_routine(db, user, routine_id) -> Routine:
    """Devuelve la rutina si el usuario es dueño o tiene asignación activa.
    Lanza 404 en cualquier otro caso."""

def has_routine_access(db, user_id, routine_id) -> bool:
    """Igual, en booleano. Para validar escritura de progreso."""
```

Reglas:

| Quién | Lectura | Escritura de rutina | Progreso / workouts |
|---|---|---|---|
| Dueño (`routine.user_id`) | Sí | Sí | Sí |
| Cliente con asignación activa | Sí | **No** (404, ya lo garantiza el filtro existente) | Sí |
| Cualquier otro | No (404) | No | No |

### Cambios en endpoints existentes

- `GET /routines` — la lista del cliente ahora incluye sus rutinas propias más
  las asignadas. Cada rutina asignada trae `assigned_by` (nombre del coach) y
  `read_only: true`. Las rutinas con `is_template = true` **se excluyen** de la
  lista propia del coach.
- `GET /routines/{id}` — pasa por `get_readable_routine`.
- `GET/PUT /workouts/progress/{routine_id}` — se agrega validación de acceso.
  Hoy estos endpoints no verifican nada: cualquier usuario puede leer y escribir
  progreso contra cualquier `routine_id`. Es un hueco preexistente que este
  cambio vuelve alcanzable de forma natural, así que se cierra aquí.
- Endpoints de escritura de rutina — **sin cambios**. Su filtro por `user_id` ya
  produce el comportamiento correcto.

## Flujo del enlace

El enlace queda como `https://<app>/r/<token>`.

### 1. Vista previa pública

`GET /share/{token}` — **autenticación opcional**: funciona sin sesión, y si el
encabezado `Authorization` viene con un token válido, lo aprovecha para
personalizar la respuesta (`already_claimed`) y registrar quién abrió el enlace.
Un token inválido o ausente no produce error, sólo se ignora. Devuelve:

```json
{
  "status": "valido",
  "routine_name": "Full Body Principiantes",
  "coach_name": "Josué",
  "days_per_week": 4,
  "objective": "hypertrophy",
  "total_exercises": 24,
  "day_names": ["Pecho/Tríceps", "Espalda/Bíceps", "Pierna", "Hombro/Core"],
  "already_claimed": false
}
```

**No devuelve los ejercicios con sets y reps.** Si los devolviera, cualquiera
copiaría la rutina sin registrarse y el enlace dejaría de ser una razón para
crear cuenta. Se muestra lo suficiente para saber qué se está recibiendo.

`status` toma uno de: `valido`, `expirado`, `revocado`, `lleno`, `no_existe`.
Cada uno con su mensaje en la interfaz — nunca un 404 genérico.

Registra la visita en `share_link_visits`. Si hay sesión, guarda el `user_id`.

`already_claimed` es true cuando el usuario en sesión ya tiene asignación activa
para esa rutina; la interfaz muestra "Ir a mi rutina" en vez de "Agregar".

### 2. Autenticación

- Sin cuenta → `/register?redirect=/r/<token>`
- Con cuenta → `/login?redirect=/r/<token>`
- Con sesión abierta → directo al botón de reclamar

`Login.jsx` y `Register.jsx` respetan el parámetro `redirect` al terminar.

Además, el token se guarda en `sessionStorage` bajo `pending_share_token` al
cargar `/r/<token>`. Si el usuario pierde el `?redirect=` en el camino, al
entrar a la app se detecta el token pendiente y se le ofrece continuar. Sin ese
respaldo el caso más común — cliente nuevo que abre el enlace en el celular y se
registra — puede terminar sin rutina y sin explicación.

El token pendiente se borra al reclamar con éxito o al llegar a un enlace
inválido.

### 3. Reclamar

`POST /share/{token}/claim` — requiere sesión.

Valida en orden, devolviendo el error específico de cada caso:

1. El enlace existe
2. No está revocado
3. No ha expirado
4. Hay cupo — `count(assignments activos con link_id) < max_claims`

Luego crea el `routine_assignment`, marca `claimed = true` en la visita, y
devuelve `{"routine_id": N}`. El front navega a `/routines/{N}`.

**Idempotente:** si ya existe asignación activa para `(routine_id, client_id)`,
devuelve el `routine_id` sin crear nada ni consumir cupo. Un cliente que refresca
la página no debe quemar un cupo de una plantilla limitada.

Los cupos cuentan asignaciones activas, no visitas. Revocar el acceso de alguien
libera su cupo.

Caso borde: si el coach borra la rutina, el `ON DELETE CASCADE` elimina enlaces y
asignaciones. El cliente deja de verla. Es el comportamiento deseado.

Caso borde: el propio coach abriendo su enlace. Se le muestra la vista previa con
un aviso de que es su rutina, y no puede reclamársela a sí mismo.

## Panel de coach

Sección `/coach`, visible sólo con `is_coach` o `is_admin`. Router nuevo
`app/routers/coach.py` con dependencia `get_coach_user`, siguiendo el patrón de
`get_admin_user` en `app/auth/security.py`.

Todas las consultas del panel filtran por `coach_id`: un coach no ve rutinas,
clientes ni solicitudes de otro coach.

### Pestaña "Rutinas"

Lista de rutinas con `is_template = true` del coach, cada una con el número de
clientes que la tienen. Crear, editar y compartir.

**Creación:** reutiliza `GenerateRoutine.jsx` y `CreateRoutine.jsx`.
`GenerateRoutineRequest` ya recibe `objective`, `days_per_week` y
`training_level` explícitos, así que basta con:

- Agregar el campo `is_template` a la petición
- Que el nivel lo elija el coach en vez de leerlo de su perfil
- **Enviar `user_data` vacío.** Hoy `generate_smart_routine` arma ese bloque con
  las patologías, medicamentos y limitaciones de movilidad de quien llama. En
  una rutina de cliente serían las condiciones médicas del coach filtrando la
  rutina de otra persona.

**Compartir:** modal con tipo de enlace (personal / plantilla), nombre interno,
límite de personas, y expiración. Muestra la URL con botones de copiar y
WhatsApp. Abajo, los enlaces ya generados con sus números — aperturas,
reclamados, cupos restantes — y botón de revocar.

### Pestaña "Clientes"

Una fila por cliente con asignación activa:

```
Juan Pérez        Full Body Principiantes
Último entreno: ayer   ·   Esta semana: 3 de 4   ·   1 solicitud
```

Todo se calcula desde datos existentes, sin tablas nuevas:

- Último entreno: `max(Workout.date)` del cliente
- Semana: workouts de la semana actual contra `routine.days_per_week`
- Solicitudes: `routine_change_requests` en estado `pendiente`

Las fechas usan `today_mx()` de `app/utils/timezone.py`, como el resto del
proyecto.

Al abrir el detalle del cliente se puede quitar el acceso
(`DELETE /coach/assignments/{id}` → `status = 'revoked'`).

Quitar el acceso **no borra el historial del cliente**: sus `Workout`,
`WorkoutSet` y `routine_progress` quedan intactos, porque son suyos y alimentan
sus gráficas de progreso y sus cálculos de 1RM. Lo único que pierde es la
capacidad de ver y entrenar esa rutina.

### Pestaña "Solicitudes"

Solicitudes pendientes con el ejercicio y la rutina de contexto. Aceptar
(el coach edita la rutina; al ser en vivo, el cliente lo ve al instante) o
rechazar con respuesta.

**Aviso de alcance:** si la rutina está asignada a más de una persona, antes de
guardar una edición el panel advierte *"Esta rutina la están usando N personas"*.
Editarla por la solicitud de una la cambia para todas. El coach decide si edita
para todos o si le arma una rutina personal a esa persona.

### Panel Admin

Interruptor `is_coach` en la edición de usuario
(`PUT /admin/users/{user_id}`, `AdminUserUpdate`).

## Interfaz del cliente

En `RoutineDetail.jsx` y `RoutineDayDetail.jsx`, cuando `read_only` es true:

- Se ocultan editar, swap, regenerar, borrar, enlazar biseries y configurar días
  de descanso
- Aparece un distintivo: **"Rutina de tu coach · Josué"**
- Aparece el botón **"Pedir un cambio"**

En `Routines.jsx`, las rutinas asignadas se muestran con su distintivo de coach
junto a las propias.

Marcar ejercicios y registrar series funciona igual que en una rutina propia.

**Pedir un cambio:** modal desde el ejercicio, guarda en
`routine_change_requests` con el `routine_exercise_id`.
`POST /routines/{id}/change-request`.

## Endpoints

### Coach — requieren `is_coach` o `is_admin`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/coach/routines` | Rutinas de cliente con conteo de asignados |
| POST | `/coach/routines` | Crear rutina de cliente |
| POST | `/coach/routines/{id}/links` | Crear enlace |
| GET | `/coach/routines/{id}/links` | Enlaces con aperturas y reclamos |
| DELETE | `/coach/links/{link_id}` | Revocar enlace |
| GET | `/coach/clients` | Clientes con adherencia |
| GET | `/coach/clients/{user_id}` | Detalle del cliente |
| DELETE | `/coach/assignments/{id}` | Quitar acceso |
| GET | `/coach/change-requests` | Solicitudes |
| PUT | `/coach/change-requests/{id}` | Responder |

### Compartir

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/share/{token}` | No | Vista previa |
| POST | `/share/{token}/claim` | Sí | Reclamar |

### Cliente

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/routines/{id}/change-request` | Pedir un cambio |

## Notificaciones

Reutilizan `Notification` y `app/services/push_service.py`.

| Evento | Destinatario | Texto |
|---|---|---|
| Cliente reclama enlace | Coach | "Juan Pérez reclamó Full Body" |
| Cliente pide cambio | Coach | "Juan Pérez pidió un cambio en Sentadilla" |
| Coach responde solicitud | Cliente | "Tu coach respondió tu solicitud" |
| Coach edita rutina asignada | Cliente | "Tu coach actualizó tu rutina" |

El último es lo que hace útil el modelo en vivo: sin aviso, el coach cambia la
rutina y el cliente entrena la de ayer sin enterarse.

## Pruebas

El backend no tiene pruebas hoy — no hay `pytest` en `requirements.txt`. Este
diseño no monta una suite para todo el proyecto, pero sí cubre esta capa: es la
primera que expone un endpoint público y la primera donde un usuario toca datos
de otro.

Se agregan `pytest` y `httpx` a `requirements.txt`, con SQLite en memoria y
`dependency_overrides` sobre `get_db`.

Casos:

1. Reclamar dos veces no duplica asignación ni consume dos cupos
2. Enlace revocado → error específico
3. Enlace expirado → error específico
4. Enlace lleno → error específico
5. El cliente asignado recibe 404 en **cada** endpoint de escritura de rutina —
   un caso por endpoint. Es la garantía de la que depende todo el diseño
6. Usuario sin asignación no puede leer la rutina
7. Usuario sin asignación no puede escribir progreso contra ella
8. Un coach no ve rutinas, clientes ni solicitudes de otro coach
9. La vista previa pública no incluye ejercicios
10. Progreso separado: dos clientes con la misma plantilla no se pisan
11. Revocar acceso libera el cupo
12. Rutinas con `is_template = true` no salen en `GET /routines` del coach

## Fuera de alcance

QR del enlace, cobros o suscripciones, chat coach-cliente (ya existen soporte y
walkie-talkie), plantillas de fábrica, y edición de la rutina por el cliente.

## Orden de construcción

Cada paso queda funcionando por sí solo:

1. Migraciones y modelos
2. `routine_access.py` + cierre del hueco de `/workouts/progress`
3. Router `/coach` — rutinas y enlaces
4. Router `/share` — vista previa y reclamo
5. Pantalla pública `/r/:token`
6. `redirect` en Login y Register + `sessionStorage`
7. Vista de solo lectura del cliente
8. Panel de coach — clientes y adherencia
9. Solicitudes de cambio, punta a punta
10. Notificaciones
