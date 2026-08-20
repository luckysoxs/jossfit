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
