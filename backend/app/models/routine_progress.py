from datetime import datetime, date as date_type

from sqlalchemy import Integer, ForeignKey, DateTime, Date, JSON, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# JSONB en PostgreSQL (coincide con la tabla que ya existe en produccion),
# JSON generico en SQLite para que las pruebas corran sin Postgres.
JSONType = JSON().with_variant(JSONB, "postgresql")


class RoutineProgress(Base):
    """Ejercicios marcados hoy, por usuario y rutina. Sincroniza entre dispositivos."""

    __tablename__ = "routine_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "routine_id", "date", name="uq_routine_progress"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    date: Mapped[date_type] = mapped_column(Date)
    checked_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
