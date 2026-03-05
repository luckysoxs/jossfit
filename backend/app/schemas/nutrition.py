from datetime import date, datetime

from pydantic import BaseModel


class NutritionLogCreate(BaseModel):
    date: date
    meal_type: str
    description: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None


class NutritionLogResponse(BaseModel):
    id: int
    user_id: int
    date: date
    meal_type: str
    description: str | None
    calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DailySummary(BaseModel):
    date: date
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    meals: list[NutritionLogResponse]
