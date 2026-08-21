"""Panel de coach: rutinas para clientes, enlaces, adherencia y solicitudes.

Todas las consultas filtran por coach_id: un coach no ve nada de otro coach.
"""

import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.auth.security import get_coach_user
from app.database import get_db
from app.models.coach import (
    RoutineAssignment, RoutineChangeRequest, RoutineShareLink, ShareLinkVisit,
)
from app.models.routine import Routine, RoutineDay, RoutineExercise
from app.models.user import User
from app.models.workout import Workout
from app.schemas.coach import (
    ChangeRequestResponse,
    ChangeRequestUpdate,
    CoachClientResponse,
    CoachRoutineResponse,
    ShareLinkCreate,
    ShareLinkResponse,
)
from app.schemas.routine import RoutineCreate, RoutineResponse
from app.services.coach_notifications import notify_request_reply
from app.utils.timezone import now_mx, today_mx

router = APIRouter(prefix="/coach", tags=["Coach"])

VALID_KINDS = ("personal", "plantilla")


# ─── Helpers ────────────────────────────────────────────────────

def _generate_token(db: Session) -> str:
    """Token no adivinable. Reintenta en el caso improbable de colision."""
    for _ in range(5):
        token = secrets.token_urlsafe(16)
        if not db.query(RoutineShareLink.id).filter(RoutineShareLink.token == token).first():
            return token
    raise HTTPException(status_code=500, detail="No se pudo generar el enlace")


def _link_stats(db: Session, link: RoutineShareLink) -> tuple[int, int, int | None]:
    """Visitas, reclamos activos y cupos restantes de un enlace."""
    visits = (
        db.query(sqlfunc.count(ShareLinkVisit.id))
        .filter(ShareLinkVisit.link_id == link.id)
        .scalar() or 0
    )
    claims = (
        db.query(sqlfunc.count(RoutineAssignment.id))
        .filter(
            RoutineAssignment.link_id == link.id,
            RoutineAssignment.status == "active",
        )
        .scalar() or 0
    )
    remaining = None if link.max_claims is None else max(0, link.max_claims - claims)
    return visits, claims, remaining


def _link_response(db: Session, link: RoutineShareLink) -> ShareLinkResponse:
    visits, claims, remaining = _link_stats(db, link)
    return ShareLinkResponse(
        id=link.id,
        token=link.token,
        path=f"/r/{link.token}",
        kind=link.kind,
        label=link.label,
        max_claims=link.max_claims,
        expires_at=link.expires_at,
        revoked=link.revoked,
        visits=visits,
        claims=claims,
        remaining=remaining,
        created_at=link.created_at,
    )


def _own_routine(db: Session, coach: User, routine_id: int) -> Routine:
    """La rutina del coach, o 404. Solo verifica propiedad; que sea plantilla
    lo comprueba quien la usa."""
    routine = (
        db.query(Routine)
        .filter(Routine.id == routine_id, Routine.user_id == coach.id)
        .first()
    )
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


# ─── Rutinas de cliente ─────────────────────────────────────────

@router.get("/routines", response_model=list[CoachRoutineResponse])
def list_coach_routines(
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    routines = (
        db.query(Routine)
        .filter(Routine.user_id == coach.id, Routine.is_template == True)  # noqa: E712
        .order_by(Routine.created_at.desc())
        .all()
    )
    out = []
    for r in routines:
        count = (
            db.query(sqlfunc.count(RoutineAssignment.id))
            .filter(
                RoutineAssignment.routine_id == r.id,
                RoutineAssignment.status == "active",
            )
            .scalar() or 0
        )
        out.append(CoachRoutineResponse(
            id=r.id, name=r.name, split_type=r.split_type,
            objective=r.objective, days_per_week=r.days_per_week,
            clients_count=count, created_at=r.created_at,
        ))
    return out


@router.post("/routines", response_model=RoutineResponse, status_code=201)
def create_coach_routine(
    data: RoutineCreate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Crea una rutina para clientes. Nace con is_template=True, asi que no
    aparece en la lista de entrenamiento propia del coach."""
    routine = Routine(
        user_id=coach.id,
        name=data.name,
        split_type=data.split_type,
        objective=data.objective,
        days_per_week=data.days_per_week,
        is_template=True,
    )
    db.add(routine)
    db.flush()

    for day_data in data.days:
        day = RoutineDay(
            routine_id=routine.id,
            day_number=day_data.day_number,
            name=day_data.name,
            focus=day_data.focus,
        )
        db.add(day)
        db.flush()
        for ex in day_data.exercises:
            db.add(RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex.exercise_id,
                order=ex.order,
                sets=ex.sets,
                reps_min=ex.reps_min,
                reps_max=ex.reps_max,
                rest_seconds=ex.rest_seconds,
                notes=ex.notes,
            ))

    db.commit()
    db.refresh(routine)
    return RoutineResponse.model_validate(routine)


# ─── Enlaces ────────────────────────────────────────────────────

@router.post("/routines/{routine_id}/links", response_model=ShareLinkResponse, status_code=201)
def create_share_link(
    routine_id: int,
    data: ShareLinkCreate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    routine = _own_routine(db, coach, routine_id)

    if not routine.is_template:
        raise HTTPException(
            status_code=400,
            detail="Solo puedes compartir rutinas hechas para clientes",
        )
    if data.kind not in VALID_KINDS:
        raise HTTPException(status_code=400, detail="Tipo de enlace invalido")

    # Un enlace personal es para una persona, sin importar lo que llegue.
    max_claims = 1 if data.kind == "personal" else data.max_claims
    if max_claims is not None and max_claims < 1:
        raise HTTPException(status_code=400, detail="El limite debe ser al menos 1")

    expires_at = None
    if data.expires_in_days is not None:
        if data.expires_in_days < 1:
            raise HTTPException(status_code=400, detail="La expiracion debe ser al menos 1 dia")
        expires_at = now_mx().replace(tzinfo=None) + timedelta(days=data.expires_in_days)

    link = RoutineShareLink(
        token=_generate_token(db),
        routine_id=routine.id,
        coach_id=coach.id,
        kind=data.kind,
        label=(data.label or "").strip() or None,
        max_claims=max_claims,
        expires_at=expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return _link_response(db, link)


@router.get("/routines/{routine_id}/links", response_model=list[ShareLinkResponse])
def list_share_links(
    routine_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    _own_routine(db, coach, routine_id)
    links = (
        db.query(RoutineShareLink)
        .filter(
            RoutineShareLink.routine_id == routine_id,
            RoutineShareLink.coach_id == coach.id,
        )
        .order_by(RoutineShareLink.created_at.desc())
        .all()
    )
    return [_link_response(db, l) for l in links]


@router.delete("/links/{link_id}")
def revoke_share_link(
    link_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Revoca el enlace. Quien ya reclamo la rutina la conserva; para quitarle
    el acceso se usa DELETE de coach/assignments/{id}."""
    link = (
        db.query(RoutineShareLink)
        .filter(RoutineShareLink.id == link_id, RoutineShareLink.coach_id == coach.id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Enlace no encontrado")
    link.revoked = True
    db.commit()
    return {"ok": True}


# ─── Solicitudes de cambio ──────────────────────────────────────

VALID_REQUEST_STATUS = ("pendiente", "aceptada", "rechazada")


def _change_request_response(db: Session, req: RoutineChangeRequest) -> ChangeRequestResponse:
    """Arma la respuesta con el contexto que el coach necesita para decidir:
    quien pidio, en que rutina y sobre que ejercicio."""
    assignment = db.query(RoutineAssignment).filter(
        RoutineAssignment.id == req.assignment_id
    ).first()
    routine = db.query(Routine).filter(Routine.id == assignment.routine_id).first()
    cliente = db.query(User).filter(User.id == req.client_id).first()

    exercise_name = None
    if req.routine_exercise_id:
        rex = db.query(RoutineExercise).filter(
            RoutineExercise.id == req.routine_exercise_id
        ).first()
        if rex and rex.exercise:
            exercise_name = rex.exercise.name_es or rex.exercise.name

    return ChangeRequestResponse(
        id=req.id,
        client_id=req.client_id,
        client_name=cliente.name if cliente else "?",
        routine_id=routine.id if routine else 0,
        routine_name=routine.name if routine else "?",
        exercise_name=exercise_name,
        content=req.content,
        status=req.status,
        coach_reply=req.coach_reply,
        created_at=req.created_at,
    )


@router.get("/change-requests", response_model=list[ChangeRequestResponse])
def list_change_requests(
    status: str | None = None,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(RoutineChangeRequest)
        .join(RoutineAssignment, RoutineChangeRequest.assignment_id == RoutineAssignment.id)
        .filter(RoutineAssignment.coach_id == coach.id)
    )
    if status:
        query = query.filter(RoutineChangeRequest.status == status)
    reqs = query.order_by(RoutineChangeRequest.created_at.desc()).all()
    return [_change_request_response(db, r) for r in reqs]


@router.put("/change-requests/{request_id}", response_model=ChangeRequestResponse)
def reply_change_request(
    request_id: int,
    data: ChangeRequestUpdate,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    req = (
        db.query(RoutineChangeRequest)
        .join(RoutineAssignment, RoutineChangeRequest.assignment_id == RoutineAssignment.id)
        .filter(
            RoutineChangeRequest.id == request_id,
            RoutineAssignment.coach_id == coach.id,
        )
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if data.status not in VALID_REQUEST_STATUS:
        raise HTTPException(status_code=400, detail="Estado invalido")

    req.status = data.status
    if data.coach_reply is not None:
        req.coach_reply = data.coach_reply.strip() or None
    db.commit()
    db.refresh(req)

    respuesta = _change_request_response(db, req)
    try:
        notify_request_reply(db, req.client_id, respuesta.routine_name, req.coach_reply)
    except Exception:
        pass
    return respuesta


# ─── Clientes y adherencia ──────────────────────────────────────

def _client_row(db: Session, assignment: RoutineAssignment) -> CoachClientResponse:
    """Una fila de adherencia. Todo sale de datos que ya existen: no hay
    tablas nuevas para esto."""
    cliente = db.query(User).filter(User.id == assignment.client_id).first()
    routine = db.query(Routine).filter(Routine.id == assignment.routine_id).first()

    hoy = today_mx()
    lunes = hoy - timedelta(days=hoy.weekday())

    ultimo = (
        db.query(sqlfunc.max(Workout.date))
        .filter(Workout.user_id == assignment.client_id)
        .scalar()
    )
    esta_semana = (
        db.query(sqlfunc.count(Workout.id))
        .filter(
            Workout.user_id == assignment.client_id,
            Workout.date >= lunes,
            Workout.date <= hoy,
        )
        .scalar() or 0
    )
    pendientes = (
        db.query(sqlfunc.count(RoutineChangeRequest.id))
        .filter(
            RoutineChangeRequest.assignment_id == assignment.id,
            RoutineChangeRequest.status == "pendiente",
        )
        .scalar() or 0
    )

    return CoachClientResponse(
        assignment_id=assignment.id,
        user_id=assignment.client_id,
        name=cliente.name if cliente else "?",
        email=cliente.email if cliente else "?",
        routine_id=assignment.routine_id,
        routine_name=routine.name if routine else "?",
        last_workout_date=ultimo.isoformat() if ultimo else None,
        workouts_this_week=esta_semana,
        days_per_week=routine.days_per_week if routine else 0,
        pending_requests=pendientes,
    )


@router.get("/clients", response_model=list[CoachClientResponse])
def list_clients(
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    asignaciones = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.coach_id == coach.id,
            RoutineAssignment.status == "active",
        )
        .order_by(RoutineAssignment.assigned_at.desc())
        .all()
    )
    return [_client_row(db, a) for a in asignaciones]


@router.get("/clients/{user_id}", response_model=list[CoachClientResponse])
def get_client_detail(
    user_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Una fila por cada rutina que el coach le tiene asignada a ese cliente."""
    asignaciones = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.coach_id == coach.id,
            RoutineAssignment.client_id == user_id,
            RoutineAssignment.status == "active",
        )
        .all()
    )
    if not asignaciones:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return [_client_row(db, a) for a in asignaciones]


@router.delete("/assignments/{assignment_id}")
def revoke_assignment(
    assignment_id: int,
    coach: User = Depends(get_coach_user),
    db: Session = Depends(get_db),
):
    """Quita el acceso. No borra el historial del cliente: sus workouts y su
    progreso son suyos y alimentan sus graficas."""
    assignment = (
        db.query(RoutineAssignment)
        .filter(
            RoutineAssignment.id == assignment_id,
            RoutineAssignment.coach_id == coach.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignacion no encontrada")
    assignment.status = "revoked"
    db.commit()
    return {"ok": True}
