from datetime import date, time, datetime

from pydantic import BaseModel


class SleepLogCreate(BaseModel):
    date: date
    hours_slept: float
    quality: int
    bedtime: time | None = None
    wake_time: time | None = None
    notes: str | None = None


class SleepLogResponse(BaseModel):
    id: int
    user_id: int
    date: date
    hours_slept: float
    quality: int
    bedtime: time | None
    wake_time: time | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
