from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    firebase_uid: str
    email: str | None
    display_name: str | None
    face_photo_url: str | None
    notif_hour: int
    timezone: str
    subscription_tier: str
    created_at: datetime
    updated_at: datetime


class UserUpsertIn(BaseModel):
    display_name: str | None = None
    face_photo_url: str | None = None
    notif_hour: int | None = None
    timezone: str | None = None


class FcmTokenIn(BaseModel):
    token: str
    platform: str = "android"
