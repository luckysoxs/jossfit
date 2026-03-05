import enum
from datetime import datetime

from sqlalchemy import String, Integer, Float, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrainingLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Sex(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[Sex] = mapped_column(Enum(Sex))
    height_cm: Mapped[float] = mapped_column(Float)
    weight_kg: Mapped[float] = mapped_column(Float)
    training_level: Mapped[TrainingLevel] = mapped_column(
        Enum(TrainingLevel), default=TrainingLevel.BEGINNER
    )
    fitness_goal: Mapped[str | None] = mapped_column(String(100), nullable=True)
    theme_preference: Mapped[str] = mapped_column(String(10), default="dark")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    routines = relationship("Routine", back_populates="user", cascade="all, delete-orphan")
    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    body_metrics = relationship("BodyMetric", back_populates="user", cascade="all, delete-orphan")
    nutrition_logs = relationship("NutritionLog", back_populates="user", cascade="all, delete-orphan")
    sleep_logs = relationship("SleepLog", back_populates="user", cascade="all, delete-orphan")
    supplements = relationship("Supplement", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
