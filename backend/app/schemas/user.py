from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

Gender = Literal["male", "female", "non_binary", "prefer_not_to_say"]
JournalingGoal = Literal[
    "self_reflection",
    "mental_health",
    "memory",
    "creativity",
    "other",
]


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
    gender: Gender | None = None
    birthday: date | None = None
    journaling_goal: JournalingGoal | None = None
    created_at: datetime
    updated_at: datetime


class UserUpsertIn(BaseModel):
    display_name: str | None = None
    face_photo_url: str | None = None
    notif_hour: int | None = None
    timezone: str | None = None
    preferred_language: Literal["en", "id"] | None = None
    gender: Gender | None = None
    birthday: date | None = None
    journaling_goal: JournalingGoal | None = None


class FcmTokenIn(BaseModel):
    token: str
    platform: str = "android"


class UserStatsOut(BaseModel):
    entries_last_30_days: int
    current_streak_days: int
    total_entries: int
    total_words: int
