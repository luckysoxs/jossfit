from pydantic import BaseModel


class ExerciseResponse(BaseModel):
    id: int
    name: str
    muscle_group: str
    secondary_muscles: str | None
    category: str
    equipment: str | None
    instructions: str | None

    model_config = {"from_attributes": True}
