# Duplicar rutinas entre coach y personal

Fecha: 2026-09-22

## Problema

Las rutinas personales (las que el coach entrena) y las rutinas para clientes
(`is_template=True`, panel de coach) viven separadas. No hay forma de:

1. Publicar una rutina personal para clientes.
2. Duplicar una rutina de cliente para adaptarla a otro cliente. Hoy los
   clientes asignados leen la rutina del coach en vivo, asi que editar la de un
   cliente cambia la de todos los que la tienen.
3. Copiar una rutina de cliente a las rutinas personales para entrenarla.

## Solucion

Un solo endpoint que copia una rutina completa a una rutina nueva e
independiente, con el destino como parametro.

### Backend

**Servicio `app/services/routine_copy.py`**

`copy_routine(db, source: Routine, owner: User, name: str, as_template: bool) -> Routine`

- Crea una `Routine` nueva con `user_id=owner.id`, `name`, `split_type`,
  `objective`, `days_per_week`, `generation_type`, `ai_data`, `rest_weekdays`
  de la original e `is_template=as_template`.
- Copia cada `RoutineDay` (`day_number`, `name`, `focus`) y cada
  `RoutineExercise` (`exercise_id`, `order`, `sets`, `reps_min`, `reps_max`,
  `rest_seconds`, `notes`, `group_id`).
- Los `group_id` de superseries se remapean a UUIDs nuevos: mismo grupo en la
  original = mismo grupo nuevo en la copia; `None` se queda `None`.
- No copia enlaces, asignaciones, solicitudes de cambio ni entrenos.
- Hace `flush`, no `commit`; el endpoint hace el commit.

**Endpoint `POST /routines/{routine_id}/duplicate`** en `routers/routines.py`

Body (`RoutineDuplicate` en `schemas/routine.py`):

```
destino: "cliente" | "mia"
name: str | None = None
```

Reglas:

- La rutina original debe ser del usuario (`Routine.user_id == user.id`), sea
  personal o de cliente. Si no, 404, igual que el resto de los endpoints de
  escritura. Un cliente con la rutina asignada tambien recibe 404.
- `destino="cliente"` exige `is_coach` o `is_admin`; si no, 403. La copia nace
  con `is_template=True`.
- `destino="mia"` crea la copia con `is_template=False`.
- Otro valor de `destino` responde 422 (validacion con `Literal`).
- `name` vacio o ausente da `"<nombre original> (copia)"`. El nombre se recorta
  a 100 caracteres, el limite de la columna.
- Responde 201 con `RoutineResponse` de la copia.

### Frontend

**`components/routines/DuplicateRoutineModal.jsx`**: modal con un input de
nombre prellenado con `"<nombre> (copia)"`, boton Cancelar y boton Confirmar.
Recibe `routine`, `destino`, `title` y `onClose`. Al confirmar llama al
endpoint y navega a `/routines/<id nuevo>`. Si falla, muestra el `detail`
del error dentro del modal.

**`components/coach/CoachRoutinesTab.jsx`**: cada tarjeta suma dos botones
junto a Compartir:

- "Duplicar" abre el modal con `destino="cliente"`.
- "A mis rutinas" abre el modal con `destino="mia"`.

**`pages/RoutineDetail.jsx`**: en una rutina propia no plantilla
(`!routine.is_template && !routine.read_only`), si el usuario es coach o admin,
aparece el boton "Compartir con clientes" que abre el modal con
`destino="cliente"`.

### Pruebas (`backend/tests/test_routine_duplicate.py`)

- Copia completa: mismos dias y ejercicios con IDs nuevos, mismos valores.
- Superseries: los ejercicios agrupados siguen agrupados entre si, con un
  `group_id` distinto al original.
- `destino="cliente"` da `is_template=True`; `destino="mia"` da `False`.
- Nombre por defecto `"(copia)"` y recorte a 100 caracteres.
- Independencia: editar un ejercicio de la copia no cambia la original.
- No se copian enlaces ni asignaciones: la copia de cliente sale con 0
  clientes en `GET /coach/routines`.
- Permisos: rutina de otro usuario, 404; cliente asignado, 404; usuario
  normal con `destino="cliente"`, 403; usuario normal con `destino="mia"`
  sobre su propia rutina, 201.

## Fuera de alcance

- Rutinas vinculadas que se sincronizan entre si.
- Duplicar en lote o duplicar un solo dia.
