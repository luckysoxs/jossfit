from datetime import date, datetime
# Alias para poder declarar un campo llamado "date" CON valor por omision: en
# `date: date | None = None` Python asigna None antes de evaluar la anotacion,
# asi que el tipo quedaria apuntando al propio campo.
from datetime import date as date_type

from pydantic import BaseModel

from app.schemas.exercise import ExerciseResponse


class WorkoutSetCreate(BaseModel):
    exercise_id: int
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None = None
    completed: bool = True
    notes: str | None = None


class WorkoutSetResponse(BaseModel):
    id: int
    exercise_id: int
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None
    completed: bool
    notes: str | None
    exercise: ExerciseResponse | None = None

    model_config = {"from_attributes": True}


class WorkoutCreate(BaseModel):
    routine_day_id: int | None = None
    date: date
    duration_minutes: int | None = None
    notes: str | None = None
    fatigue_level: int | None = None
    sets: list[WorkoutSetCreate] = []


class WorkoutResponse(BaseModel):
    id: int
    user_id: int
    routine_day_id: int | None
    date: date
    duration_minutes: int | None
    notes: str | None
    fatigue_level: int | None
    created_at: datetime
    sets: list[WorkoutSetResponse] = []

    model_config = {"from_attributes": True}


class BulkSetItem(BaseModel):
    exercise_id: int
    weight_kg: float
    reps: int


class BulkSetsCreate(BaseModel):
    sets: list[BulkSetItem]
    # De que dia de rutina salio el entreno. Sin esto no hay forma de saber a
    # que rutina pertenece, y la adherencia que ve un coach no se puede acotar
    # a la rutina que el dio.
    routine_day_id: int | None = None
    # Fecha del entrenamiento. La manda el cliente para que una accion
    # encolada sin internet caiga en el dia en que se marco, no en el dia en
    # que se reenvia. Si no viene, es hoy.
    date: date_type | None = None
