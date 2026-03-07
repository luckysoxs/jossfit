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


class CategoryScore(BaseModel):
    category: str  # "push", "pull", "legs", "core"
    label: str  # "Empuje", "Tirón", "Piernas", "Core"
    total_1rm: float
    exercise_count: int
    top_exercise: str | None = None
    top_1rm: float | None = None


class StrengthScoreResponse(BaseModel):
    total_score: float  # sum of all best 1RMs
    categories: list[CategoryScore]
    body_weight: float | None = None
    strength_ratio: float | None = None  # total / bodyweight
    previous_score: float | None = None  # 30 days ago
    change_pct: float | None = None  # % improvement
