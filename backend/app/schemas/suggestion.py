from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SuggestionCreate(BaseModel):
    category: str
    content: str


class SuggestionResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    category: str
    content: str
    status: str
    admin_reply: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SuggestionUpdate(BaseModel):
    status: Optional[str] = None
    admin_reply: Optional[str] = None
