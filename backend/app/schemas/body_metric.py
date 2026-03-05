from datetime import date, datetime

from pydantic import BaseModel


class BodyMetricCreate(BaseModel):
    date: date
    weight_kg: float | None = None
    body_fat_pct: float | None = None
    muscle_mass_kg: float | None = None
    waist_cm: float | None = None
    chest_cm: float | None = None
    arm_cm: float | None = None
    leg_cm: float | None = None
    notes: str | None = None


class BodyMetricResponse(BaseModel):
    id: int
    user_id: int
    date: date
    weight_kg: float | None
    body_fat_pct: float | None
    muscle_mass_kg: float | None
    waist_cm: float | None
    chest_cm: float | None
    arm_cm: float | None
    leg_cm: float | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
