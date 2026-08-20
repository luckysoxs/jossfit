"""Modelos para compartir rutinas de coach a clientes.

Los cuatro cambian juntos y describen un solo dominio: el coach genera un
enlace, alguien lo abre (visita), lo reclama (asignacion), y desde ahi puede
pedir cambios.
"""

from datetime import datetime

from sqlalchemy import (
    String, Integer, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RoutineShareLink(Base):
    """Un enlace compartible. `kind` distingue enlace personal de plantilla."""

    __tablename__ = "routine_share_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"), index=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # 'personal' | 'plantilla'
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    max_claims: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None = ilimitado
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # None = nunca
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    routine = relationship("Routine")
    coach = relationship("User", foreign_keys=[coach_id])


class RoutineAssignment(Base):
    """Un cliente con acceso a una rutina del coach.

    El UNIQUE(routine_id, client_id) es lo que hace idempotente el reclamo:
    refrescar la pagina no crea otra asignacion ni consume otro cupo.
    """

    __tablename__ = "routine_assignments"
    __table_args__ = (
        UniqueConstraint("routine_id", "client_id", name="uq_routine_assignment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id", ondelete="CASCADE"))
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    coach_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    link_id: Mapped[int | None] = mapped_column(
        ForeignKey("routine_share_links.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(10), default="active")  # 'active' | 'revoked'
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    routine = relationship("Routine")
    client = relationship("User", foreign_keys=[client_id])
    coach = relationship("User", foreign_keys=[coach_id])


class ShareLinkVisit(Base):
    """Quien abrio un enlace. `user_id` es NULL si aun no habia sesion."""

    __tablename__ = "share_link_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    link_id: Mapped[int] = mapped_column(
        ForeignKey("routine_share_links.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    visited_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RoutineChangeRequest(Base):
    """El cliente pide un cambio; el coach acepta o rechaza con respuesta."""

    __tablename__ = "routine_change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("routine_assignments.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("routine_exercises.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15), default="pendiente", index=True)
    coach_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    assignment = relationship("RoutineAssignment")
    client = relationship("User")
