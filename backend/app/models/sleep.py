from datetime import date, time, datetime

from sqlalchemy import Integer, Float, ForeignKey, Date, Time, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SleepLog(Base):
    __tablename__ = "sleep_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    hours_slept: Mapped[float] = mapped_column(Float)
    quality: Mapped[int] = mapped_column(Integer)  # 1-10
    bedtime: Mapped[time | None] = mapped_column(Time, nullable=True)
    wake_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="sleep_logs")
