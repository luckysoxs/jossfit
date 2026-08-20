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
