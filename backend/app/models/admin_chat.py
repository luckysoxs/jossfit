from datetime import datetime

from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AdminChat(Base):
    __tablename__ = "admin_chats"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    members = relationship(
        "AdminChatMember", back_populates="chat", cascade="all, delete-orphan"
    )
    messages = relationship(
        "AdminChatMessage", back_populates="chat", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])


class AdminChatMember(Base):
    __tablename__ = "admin_chat_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admin_chats.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    chat = relationship("AdminChat", back_populates="members")
    user = relationship("User")


class AdminChatMessage(Base):
    __tablename__ = "admin_chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("admin_chats.id", ondelete="CASCADE"), index=True
    )
    sender_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE")
    )
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )

    chat = relationship("AdminChat", back_populates="messages")
    sender = relationship("User")
