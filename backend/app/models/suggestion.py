from datetime import datetime

from sqlalchemy import Text, String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Suggestion(Base):
    __tablename__ = "suggestions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(20))  # mejora, idea, bug, otro
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pendiente")  # pendiente, visto, implementado
    admin_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    user = relationship("User", backref="suggestions")
