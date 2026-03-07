from pydantic import BaseModel, Field


class ExerciseResponse(BaseModel):
    id: int
    name: str
    name_es: str | None
    muscle_group: str
    secondary_muscles: str | None
    category: str
    equipment: str | None
    instructions: str | None

    model_config = {"from_attributes": True}


class CreateExerciseRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    name_es: str | None = Field(None, max_length=100)
    muscle_group: str
    category: str = "compound"
    equipment: str | None = None
