from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    split_type: Mapped[str] = mapped_column(String(50))
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)
    days_per_week: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="routines")
    days = relationship("RoutineDay", back_populates="routine", cascade="all, delete-orphan")


class RoutineDay(Base):
    __tablename__ = "routine_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    day_number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(100))
    focus: Mapped[str | None] = mapped_column(String(100), nullable=True)

    routine = relationship("Routine", back_populates="days")
    exercises = relationship("RoutineExercise", back_populates="routine_day", cascade="all, delete-orphan")


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_day_id: Mapped[int] = mapped_column(ForeignKey("routine_days.id", ondelete="CASCADE"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    order: Mapped[int] = mapped_column(Integer)
    sets: Mapped[int] = mapped_column(Integer)
    reps_min: Mapped[int] = mapped_column(Integer)
    reps_max: Mapped[int] = mapped_column(Integer)
    rest_seconds: Mapped[int] = mapped_column(Integer, default=90)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    routine_day = relationship("RoutineDay", back_populates="exercises")
    exercise = relationship("Exercise")
