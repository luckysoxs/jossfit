from datetime import date, datetime

from sqlalchemy import Integer, Float, String, ForeignKey, Date, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OneRepMax(Base):
    __tablename__ = "one_rep_maxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    estimated_1rm: Mapped[float] = mapped_column(Float)
    formula_used: Mapped[str] = mapped_column(String(20))
    date: Mapped[date] = mapped_column(Date)
    source_weight: Mapped[float] = mapped_column(Float)
    source_reps: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    exercise = relationship("Exercise")
