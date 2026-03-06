from datetime import datetime, date

from pydantic import BaseModel

from app.schemas.user import UserResponse


class AdminUserListItem(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None = None
    country_code: str = "+52"
    sex: str
    age: int
    training_level: str
    fitness_goal: str | None = None
    is_admin: bool = False
    created_at: datetime
    total_workouts: int = 0
    last_workout_date: date | None = None

    model_config = {"from_attributes": True}


class AdminUserStats(BaseModel):
    total_workouts: int = 0
    total_routines: int = 0
    total_nutrition_logs: int = 0
    total_sleep_logs: int = 0
    total_supplements: int = 0
    total_goals: int = 0
    total_body_metrics: int = 0
    last_workout_date: date | None = None
    avg_workout_duration: float | None = None
    latest_weight: float | None = None


class AdminUserDetail(BaseModel):
    user: UserResponse
    workouts: list = []
    routines: list = []
    body_metrics: list = []
    nutrition_logs: list = []
    sleep_logs: list = []
    supplements: list = []
    goals: list = []
    stats: AdminUserStats


class AdminUserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    age: int | None = None
    sex: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    training_level: str | None = None
    fitness_goal: str | None = None
    phone: str | None = None
    country_code: str | None = None
    is_admin: bool | None = None


class PaginatedUsers(BaseModel):
    users: list[AdminUserListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class GlobalStats(BaseModel):
    total_users: int = 0
    new_users_this_week: int = 0
    new_users_this_month: int = 0
    active_users_today: int = 0
    active_users_this_week: int = 0
    total_workouts: int = 0
    workouts_this_week: int = 0
    avg_workouts_per_user: float = 0.0
    training_level_distribution: dict[str, int] = {}
    sex_distribution: dict[str, int] = {}
    goal_distribution: dict[str, int] = {}
