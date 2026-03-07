from datetime import datetime
from pydantic import BaseModel


# ─── Request Schemas ────────────────────────────────────────

class CreateChatRequest(BaseModel):
    """Para DM: enviar recipient_id. Para grupo: enviar name + member_ids."""
    recipient_id: int | None = None
    name: str | None = None
    member_ids: list[int] | None = None


class SendMessageRequest(BaseModel):
    content: str


class SendVoiceRequest(BaseModel):
    audio_base64: str
    duration: float


class UpdateChatRequest(BaseModel):
    name: str | None = None
    add_member_ids: list[int] | None = None
    remove_member_ids: list[int] | None = None


# ─── Response Schemas ───────────────────────────────────────

class ChatMemberResponse(BaseModel):
    user_id: int
    user_name: str

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: str = "text"
    audio_duration: float | None = None
    audio_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatListItem(BaseModel):
    id: int
    name: str | None
    is_group: bool
    members: list[ChatMemberResponse]
    last_message: str | None
    last_message_at: datetime | None
    unread_count: int

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    unread: int
