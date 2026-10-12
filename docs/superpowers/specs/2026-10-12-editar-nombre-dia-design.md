# Editar el nombre de un dia de entrenamiento

Fecha: 2026-10-12

## Problema

El nombre de un dia (`RoutineDay.name`, p. ej. "Pecho") solo se puede escribir
al generar o crear la rutina. Despues no hay forma de cambiarlo: no existe
endpoint para editar un dia, y la interfaz solo muestra el nombre.

## Solucion

Un endpoint para renombrar un dia, y el titulo de la pantalla del dia
convertido en campo editable, con el mismo gesto que ya tiene el nombre de la
rutina en `RoutineDetail.jsx`: se toca el titulo, se escribe, Enter guarda.

### Backend

**Endpoint `PUT /routines/days/{routine_day_id}`** en `routers/routines.py`,
junto a los demas endpoints de `/days/` (zona de rutas estaticas, antes de las
parametrizadas por `{routine_id}`).

Body (`RoutineDayUpdate` en `schemas/routine.py`):

```
name: str
```

Reglas:

- El dia debe pertenecer a una rutina del usuario. Se filtra con
  `db.query(RoutineDay).join(Routine).filter(RoutineDay.id == routine_day_id,
  Routine.user_id == user.id)`, igual que `PUT /routines/exercises/{id}`. Si no
  aparece, 404 `"Day not found"`. Un cliente con la rutina asignada cae aqui.
- Nombre vacio o solo espacios: 400 `"Escribe un nombre para el dia"`.
- El nombre se recorta a 100 caracteres, el limite de la columna.
- El nombre no lleva el dia de la semana: el "Lunes" del titulo lo pone la app
  con `getWeekdayMap` a partir de los dias de descanso. Un nombre que empiece
  por un dia de la semana seguido de guion ("Lunes - Pecho") se rechaza con 400
  `"El dia de la semana se pone solo; escribe solo el nombre"`, para no repetir
  el prefijo. La comparacion ignora acentos y mayusculas, porque `WEEKDAY_NAMES`
  trae "Miercoles" y "Sabado" con acento en el frontend.
- Responde `{"ok": true, "name": "<nombre guardado>"}`, como el endpoint vecino
  de ejercicios, que tambien responde `{"ok": true}`.

### Frontend

**`pages/RoutineDayDetail.jsx`**: el `<h2>` del titulo ([:585]) pasa a ser:

- Con `readOnly` (rutina asignada por un coach): texto plano, sin cambios.
- Si la rutina es propia: un boton con el texto y un icono `Pencil` que al
  tocarse cambia por un `<form>` con un `<input className="input">`,
  `autoFocus`, `maxLength={100}`.
- Guarda al enviar (Enter) y al salir del campo (`onBlur`). Escape cancela, con
  el mismo `cancellingRef` que usa `RoutineDetail.jsx` para que el `onBlur` que
  dispara Escape no guarde.
- Un nombre vacio cancela sin llamar al servidor.
- Al guardar llama al endpoint y luego `reloadRoutine()` ([:269]), que ya
  refresca la rutina y su cache offline, asi el nombre nuevo aparece tambien en
  la lista de dias y en el banner de hoy.
- Si el servidor responde error, el mensaje (`detail`) se muestra bajo el campo
  y el campo sigue abierto para corregir.
- El input edita solo `day.name`. El prefijo del dia de la semana se sigue
  calculando aparte y no entra al campo.

### Pruebas

**`backend/tests/test_routine_day_rename.py`**

- Renombrar un dia propio: 200, y `GET /routines/{id}` ya devuelve el nombre.
- Nombre vacio y nombre de solo espacios: 400, y el nombre no cambia.
- Nombre que empieza con dia de la semana y guion: 400 (con y sin acento,
  "Miercoles - Pierna" y "miércoles - pierna").
- Un nombre que solo contiene un dia de la semana sin guion ("Lunes") se
  acepta: la regla es sobre el prefijo repetido, no sobre la palabra.
- Nombre de mas de 100 caracteres: se guarda recortado a 100.
- Dia de una rutina de otro usuario: 404.
- Dia de una rutina asignada, pedido por el cliente: 404.
- Dia inexistente: 404.

**`frontend/src/pages/RoutineDayDetail.test.jsx`**

- Tocar el titulo abre el input con el nombre actual.
- Enter manda `PUT /routines/days/<id>` con el nombre nuevo y recarga la rutina.
- Escape cierra sin llamar al servidor.
- Con `read_only` no hay boton para editar el titulo.

## Fuera de alcance

- Renombrar dias desde la lista de la rutina (`RoutineDetail.jsx`).
- Editar `focus` o el dia de la semana asignado.
