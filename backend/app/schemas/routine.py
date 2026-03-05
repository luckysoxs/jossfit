from datetime import datetime

from pydantic import BaseModel

from app.schemas.exercise import ExerciseResponse


class RoutineExerciseCreate(BaseModel):
    exercise_id: int
    order: int
    sets: int
    reps_min: int
    reps_max: int
    rest_seconds: int = 90
    notes: str | None = None


class RoutineExerciseResponse(BaseModel):
    id: int
    exercise_id: int
    order: int
    sets: int
    reps_min: int
    reps_max: int
    rest_seconds: int
    notes: str | None
    exercise: ExerciseResponse | None = None

    model_config = {"from_attributes": True}


class RoutineDayCreate(BaseModel):
    day_number: int
    name: str
    focus: str | None = None
    exercises: list[RoutineExerciseCreate] = []


class RoutineDayResponse(BaseModel):
    id: int
    day_number: int
    name: str
    focus: str | None
    exercises: list[RoutineExerciseResponse] = []

    model_config = {"from_attributes": True}


class RoutineCreate(BaseModel):
    name: str
    split_type: str
    objective: str | None = None
    days_per_week: int
    days: list[RoutineDayCreate] = []


class RoutineResponse(BaseModel):
    id: int
    user_id: int
    name: str
    split_type: str
    objective: str | None
    days_per_week: int
    created_at: datetime
    days: list[RoutineDayResponse] = []

    model_config = {"from_attributes": True}
