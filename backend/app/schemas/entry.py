from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EntryPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    storage_key: str
    position: int


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    question_id: UUID | None
    body: str
    emotion_tags: list[str]
    written_at: datetime
    created_at: datetime
    updated_at: datetime
    photos: list[EntryPhotoOut] = Field(default_factory=list)


class EntryCreateIn(BaseModel):
    question_id: UUID | None = None
    body: str = Field(min_length=1, max_length=10_000)
    photo_storage_keys: list[str] = Field(default_factory=list, max_length=5)
    written_at: datetime | None = None


class EntryUpdateIn(BaseModel):
    body: str = Field(min_length=1, max_length=10_000)


class EntryListOut(BaseModel):
    items: list[EntryOut]
    next_cursor: str | None = None


class PresignedUploadOut(BaseModel):
    upload_url: str
    storage_key: str
    expires_in_seconds: int


class DirectUploadOut(BaseModel):
    storage_key: str
    public_url: str
