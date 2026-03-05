from datetime import datetime

from pydantic import BaseModel


class SupplementCreate(BaseModel):
    name: str
    dose: str | None = None
    schedule: str | None = None
    notes: str | None = None
    active: bool = True


class SupplementUpdate(BaseModel):
    name: str | None = None
    dose: str | None = None
    schedule: str | None = None
    notes: str | None = None
    active: bool | None = None


class SupplementResponse(BaseModel):
    id: int
    user_id: int
    name: str
    dose: str | None
    schedule: str | None
    notes: str | None
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
