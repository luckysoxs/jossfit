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
    nombre = (name or "").strip()
    if nombre:
        return nombre[:NAME_MAX]
    # Se recorta la base primero para que el sufijo siempre sobreviva.
    sufijo = " (copia)"
    return original[:NAME_MAX - len(sufijo)] + sufijo


def copy_routine(
    db: Session,
    source: Routine,
    owner: User,
    name: str | None,
    as_template: bool,
) -> Routine:
    """Crea la copia de `source` para `owner`. Hace flush, no commit."""
    # ai_data trae el perfil medico del dueno, no solo los ejercicios: al
    # pasar de personal a rutina de clientes se descarta por completo.
    a_clientes = not source.is_template and as_template
    copia = Routine(
        user_id=owner.id,
        name=_copy_name(source.name, name),
        split_type=source.split_type,
        objective=source.objective,
        days_per_week=source.days_per_week,
        generation_type="normal" if a_clientes else source.generation_type,
        ai_data=None if a_clientes else copy.deepcopy(source.ai_data),
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
