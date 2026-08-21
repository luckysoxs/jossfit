from datetime import datetime

from pydantic import BaseModel


# ─── Enlaces ────────────────────────────────────────────────────

class ShareLinkCreate(BaseModel):
    kind: str                           # 'personal' | 'plantilla'
    label: str | None = None
    max_claims: int | None = None       # None = ilimitado; en 'personal' se fuerza a 1
    expires_in_days: int | None = None  # None = nunca expira


class ShareLinkResponse(BaseModel):
    id: int
    token: str
    path: str                           # "/r/<token>" — el front le antepone su origen
    kind: str
    label: str | None
    max_claims: int | None
    expires_at: datetime | None
    revoked: bool
    visits: int
    claims: int
    remaining: int | None               # None si es ilimitado
    created_at: datetime


# ─── Rutinas de cliente ─────────────────────────────────────────

class CoachRoutineResponse(BaseModel):
    id: int
    name: str
    split_type: str
    objective: str | None
    days_per_week: int
    clients_count: int
    created_at: datetime


# ─── Clientes ───────────────────────────────────────────────────

class CoachClientResponse(BaseModel):
    assignment_id: int
    user_id: int
    name: str
    email: str
    routine_id: int
    routine_name: str
    last_workout_date: str | None       # ISO o None si nunca entreno
    workouts_this_week: int
    days_per_week: int
    pending_requests: int


# ─── Solicitudes de cambio ──────────────────────────────────────

class ChangeRequestCreate(BaseModel):
    routine_exercise_id: int | None = None
    content: str


class ChangeRequestResponse(BaseModel):
    id: int
    client_id: int
    client_name: str
    routine_id: int
    routine_name: str
    exercise_name: str | None
    content: str
    status: str
    coach_reply: str | None
    created_at: datetime


class ChangeRequestUpdate(BaseModel):
    status: str                         # 'aceptada' | 'rechazada'
    coach_reply: str | None = None


# ─── Compartir ──────────────────────────────────────────────────

class SharePreviewResponse(BaseModel):
    """Vista previa publica. Deliberadamente sin ejercicios: si mandara la
    rutina completa, cualquiera la copiaria sin registrarse."""
    status: str                    # 'valido' | 'revocado' | 'expirado' | 'lleno' | 'no_existe'
    routine_name: str | None = None
    coach_name: str | None = None
    days_per_week: int | None = None
    objective: str | None = None
    total_exercises: int = 0
    day_names: list[str] = []
    already_claimed: bool = False
    is_own: bool = False


class ClaimResponse(BaseModel):
    routine_id: int
    routine_name: str
