from datetime import date

from pydantic import BaseModel


class StrengthProgress(BaseModel):
    exercise_name: str
    dates: list[date]
    values: list[float]


class DashboardSummary(BaseModel):
    total_workouts: int
    workouts_this_week: int
    current_streak: int
    avg_workout_duration: float
    strength_progress: list[StrengthProgress]
    weekly_volume: dict[str, int]  # muscle_group -> sets
    latest_body_weight: float | None
    body_weight_trend: list[dict]
    avg_sleep_quality: float | None
    avg_sleep_hours: float | None
    recovery_score: int  # 0-100
    active_routine_id: int | None = None
    active_routine_name: str | None = None
