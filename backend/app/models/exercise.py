import enum

from sqlalchemy import String, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MuscleGroup(str, enum.Enum):
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    BICEPS = "biceps"
    TRICEPS = "triceps"
    QUADRICEPS = "quadriceps"
    HAMSTRINGS = "hamstrings"
    GLUTES = "glutes"
    CALVES = "calves"
    ABS = "abs"
    FOREARMS = "forearms"
    TRAPS = "traps"
    FULL_BODY = "full_body"
    CARDIO = "cardio"


class ExerciseCategory(str, enum.Enum):
    COMPOUND = "compound"
    ISOLATION = "isolation"
    CARDIO = "cardio"
    MOBILITY = "mobility"


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    muscle_group: Mapped[MuscleGroup] = mapped_column(Enum(MuscleGroup))
    secondary_muscles: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[ExerciseCategory] = mapped_column(Enum(ExerciseCategory))
    equipment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
