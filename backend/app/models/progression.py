import enum
from datetime import date, datetime

from sqlalchemy import Float, String, ForeignKey, Date, DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProgressionAction(str, enum.Enum):
    INCREASE = "increase"
    MAINTAIN = "maintain"
    DECREASE = "decrease"


class ProgressionLog(Base):
    __tablename__ = "progression_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    previous_weight: Mapped[float] = mapped_column(Float)
    recommended_weight: Mapped[float] = mapped_column(Float)
    action: Mapped[ProgressionAction] = mapped_column(Enum(ProgressionAction))
    date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    exercise = relationship("Exercise")
