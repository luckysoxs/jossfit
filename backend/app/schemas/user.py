from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    training_level: str = "beginner"
    fitness_goal: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    training_level: str | None = None
    fitness_goal: str | None = None
    theme_preference: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    age: int
    sex: str
    height_cm: float
    weight_kg: float
    training_level: str
    fitness_goal: str | None
    theme_preference: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
