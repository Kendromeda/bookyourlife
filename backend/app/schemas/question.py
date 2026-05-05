from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    text: str
    source: str
    asked_at: datetime
    answered_entry_id: UUID | None


class QuestionPendingOut(BaseModel):
    status: Literal["pending"] = "pending"
