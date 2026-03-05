import enum
from datetime import date, datetime

from sqlalchemy import String, Float, ForeignKey, Date, DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GoalType(str, enum.Enum):
    FAT_LOSS = "fat_loss"
    MUSCLE_GAIN = "muscle_gain"
    RECOMPOSITION = "recomposition"
    STRENGTH = "strength"
    ENDURANCE = "endurance"


class GoalStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    goal_type: Mapped[GoalType] = mapped_column(Enum(GoalType))
    target_value: Mapped[float] = mapped_column(Float)
    current_value: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(50))
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[GoalStatus] = mapped_column(Enum(GoalStatus), default=GoalStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="goals")
