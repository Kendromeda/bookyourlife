from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    clerk_id: str
    email: str | None
    display_name: str | None
    face_photo_url: str | None
    notif_hour: int
    timezone: str
    preferred_language: Literal["en", "id"]
    subscription_tier: str
    created_at: datetime
    updated_at: datetime


class UserUpsertIn(BaseModel):
    display_name: str | None = None
    face_photo_url: str | None = None
    notif_hour: int | None = None
    timezone: str | None = None
    preferred_language: Literal["en", "id"] | None = None


class FcmTokenIn(BaseModel):
    token: str
    platform: str = "android"
