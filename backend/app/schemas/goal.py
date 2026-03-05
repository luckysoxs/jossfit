from datetime import date, datetime

from pydantic import BaseModel


class GoalCreate(BaseModel):
    goal_type: str
    target_value: float
    current_value: float = 0
    unit: str
    deadline: date | None = None


class GoalUpdate(BaseModel):
    current_value: float | None = None
    status: str | None = None
    target_value: float | None = None
    deadline: date | None = None


class GoalResponse(BaseModel):
    id: int
    user_id: int
    goal_type: str
    target_value: float
    current_value: float
    unit: str
    deadline: date | None
    status: str
    created_at: datetime
    progress_pct: float = 0

    model_config = {"from_attributes": True}
