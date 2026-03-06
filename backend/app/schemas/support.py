from datetime import datetime

from pydantic import BaseModel


class SupportMessageCreate(BaseModel):
    content: str


class SupportMessageResponse(BaseModel):
    id: int
    user_id: int
    content: str
    is_from_admin: bool
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    user_id: int
    user_name: str
    user_email: str
    last_message: str
    last_message_at: datetime
    unread_count: int
