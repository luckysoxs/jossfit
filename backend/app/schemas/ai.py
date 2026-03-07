from pydantic import BaseModel


class CustomDayConfig(BaseModel):
    name: str
    muscles: list[str]


class GenerateRoutineRequest(BaseModel):
    objective: str
    days_per_week: int
    training_level: str
    priority_muscles: list[str] = []
    split_preference: str | None = None
    custom_days: list[CustomDayConfig] | None = None


class OneRepMaxResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    epley_1rm: float
    brzycki_1rm: float
    average_1rm: float
    source_weight: float
    source_reps: int


class ProgressionResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    current_weight: float
    recommended_weight: float
    action: str
    reason: str


class VolumeAnalysis(BaseModel):
    muscle_group: str
    weekly_sets: int
    status: str  # "optimal", "low", "high"
    recommendation: str


class TrainingAnalysis(BaseModel):
    volume_analysis: list[VolumeAnalysis]
    overtraining_risk: str  # "low", "moderate", "high"
    overtraining_alerts: list[str]
    deload_recommended: bool
    deload_reason: str | None
    weeks_since_deload: int
