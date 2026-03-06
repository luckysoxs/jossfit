from datetime import date, datetime

from pydantic import BaseModel


class CardioSessionCreate(BaseModel):
    date: date
    cardio_type: str
    equipment: str
    duration_minutes: int
    level: int
    calories_estimated: float | None = None


class CardioSessionResponse(BaseModel):
    id: int
    user_id: int
    date: date
    cardio_type: str
    equipment: str
    duration_minutes: int
    level: int
    calories_estimated: float | None
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
