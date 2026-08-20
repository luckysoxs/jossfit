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
