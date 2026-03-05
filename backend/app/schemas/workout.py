from datetime import date, datetime

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
