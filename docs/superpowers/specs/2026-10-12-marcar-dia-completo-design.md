# Marcar todo el dia con los registros de la ultima vez

Fecha: 2026-10-12

## Problema

Marcar un dia completo son 8 o 9 toques: cada ejercicio abre un modal que pide
peso y reps uno por uno (`RoutineDayDetail.jsx`, `handleExerciseCheck`). Cuando
el entreno fue igual al anterior, el usuario teclea los mismos numeros otra vez.

Ademas ese modal precarga el **record** (la serie mas pesada de la historia,
`GET /workouts/personal-bests`), no la ultima vez, asi que ni siquiera sirve
como atajo para repetir el entreno anterior.

## Solucion

Un boton que registra de golpe todos los ejercicios de fuerza pendientes del
dia, copiando para cada uno el peso y las reps de la ultima serie que el usuario
registro de ese ejercicio. Antes de guardar muestra un resumen editable.

### Backend

**`GET /workouts/last-sets`** en `routers/workouts.py`

- Para cada `exercise_id` del usuario, la ultima serie completada
  (`WorkoutSet.completed == True`), eligiendo por `Workout.date` descendente y,
  a igual fecha, por `WorkoutSet.id` descendente.
- Responde una lista de `{"exercise_id": int, "weight_kg": float, "reps": int}`,
  misma forma que `GET /workouts/personal-bests`, para que el frontend la
  consuma igual.
- Solo series del usuario autenticado (`Workout.user_id == user.id`).

**`POST /workouts/bulk-sets`** en `routers/workouts.py`

Body, dos schemas nuevos en `schemas/workout.py` (junto a los que ya hay:
`WorkoutSetCreate`, `WorkoutSetResponse`, `WorkoutCreate`, `WorkoutResponse`):

```
class BulkSetItem(BaseModel):
    exercise_id: int
    weight_kg: float
    reps: int


class BulkSetsCreate(BaseModel):
    sets: list[BulkSetItem]
```

- Reglas, las mismas que `POST /workouts/quick-set` ya aplica para una serie:
  busca el entrenamiento de hoy (`today_mx()`) del usuario y lo crea si no
  existe; numera cada `set_number` correlativo a partir de las series que ya
  tiene ese entrenamiento; marca `completed=True`.
- Registra el 1RM estimado (`OneRepMax`) solo cuando `1 <= reps <= 10` y
  `weight_kg > 0`, igual que `quick-set`. Un ejercicio sin historial que se
  guarda con 0 kg no genera 1RM.
- `weight_kg` negativo o `reps < 1`: 400 `"Peso o repeticiones invalidos"`.
  `weight_kg == 0` SI es valido: es el peso real de dominadas, fondos o plancha.
- Lista vacia: 400 `"No hay series para guardar"`.
- Maximo 50 series por llamada: 400 `"Demasiadas series en una sola peticion"`.
- Todo en una transaccion: o se guardan todas, o ninguna.
- Responde `{"ok": true, "saved": <cuantas>, "workout_id": <id>}`.

### Frontend

**`pages/RoutineDayDetail.jsx`**

- La pantalla ya carga `GET /workouts/personal-bests` al montar; se agrega
  `GET /workouts/last-sets` al mismo `Promise.all` y se guarda en `lastSets`.
- Boton **"Marcar todo el dia"** en el encabezado del dia, visible solo si
  `!readOnly` y hay al menos un ejercicio de fuerza sin marcar. Los ejercicios
  de cardio no participan: se detectan con el `isCardioExercise` que ya existe
  en el archivo (`muscle_group === 'cardio' && category === 'cardio'`) y se
  siguen marcando a mano, porque peso y reps no les aplican.
- Al tocarlo abre un modal de confirmacion con una fila por ejercicio pendiente:
  - **Con historial:** peso y reps de `lastSets`, en la unidad que el usuario
    tenga configurada (`useWeightUnit`).
  - **Sin historial:** la etiqueta "sin historial", las reps del `reps_min` del
    ejercicio en la rutina, y un campo de peso editable que arranca en 0. Asi el
    usuario puede teclear el peso real y no arrastrar un 0 kg que luego seria
    "la ultima vez" de ese ejercicio.
  - Cancelar no guarda nada.
- Al confirmar manda un solo `POST /workouts/bulk-sets` con la lista completa
  (pesos convertidos a kg con `toKg`), marca como hechos todos esos ejercicios
  en `checked`, persiste el progreso y refresca la pantalla.
- Sin conexion, o si la peticion falla, se encola con `queueAction` igual que una
  serie individual; la cola ya soporta cuerpo (`{ method, url, data, description }`).

### Pruebas

**`backend/tests/test_workouts_bulk_sets.py`**

- `last-sets` devuelve la ultima serie y no la mas pesada: con 100 kg el lunes y
  80 kg el miercoles, devuelve 80.
- `last-sets` desempata por `WorkoutSet.id` cuando hay dos series el mismo dia.
- `last-sets` ignora series con `completed=False`.
- `last-sets` no devuelve series de otro usuario.
- `bulk-sets` guarda todas las series en el entrenamiento de hoy, con
  `set_number` correlativo.
- `bulk-sets` reutiliza el entrenamiento de hoy si ya existe y sigue la
  numeracion desde la ultima serie.
- `bulk-sets` con `weight_kg=0` guarda la serie y no crea `OneRepMax`.
- `bulk-sets` con peso mayor a 0 y reps entre 1 y 10 crea `OneRepMax`.
- `bulk-sets` con lista vacia: 400. Con mas de 50 series: 400. Con `reps=0` o
  peso negativo: 400 y no guarda nada (la transaccion no deja series a medias).
- `bulk-sets` sin token: 401.

**`frontend/src/pages/RoutineDayDetail.test.jsx`** (se agrega al archivo que ya existe)

- El boton no aparece cuando todos los ejercicios de fuerza ya estan marcados.
- El boton no aparece en una rutina `read_only`.
- El resumen muestra el peso y las reps de la ultima vez para un ejercicio con
  historial.
- Un ejercicio sin historial aparece con "sin historial" y su campo de peso en 0.
- Confirmar manda un solo `POST /workouts/bulk-sets` con todas las series.
- Cancelar no llama al servidor.

## Fuera de alcance

- Marcar cardio de golpe.
- Cambiar lo que precarga el modal de una sola serie (hoy el record). Queda como
  esta para no tocar un flujo que ya funciona.
- Deshacer el dia completo de un toque: desmarcar sigue siendo ejercicio por
  ejercicio.
