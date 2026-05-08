from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EntryPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    storage_key: str
    position: int


class EntryVideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    storage_key: str
    duration_seconds: int | None = None
    position: int


class EntryAudioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    storage_key: str
    duration_seconds: int | None = None
    transcript: str | None = None
    position: int


class MediaInput(BaseModel):
    storage_key: str
    duration_seconds: int | None = None


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
    lat: float | None = None
    lng: float | None = None
    place_name: str | None = None
    weather: str | None = None
    photos: list[EntryPhotoOut] = Field(default_factory=list)
    videos: list[EntryVideoOut] = Field(default_factory=list)
    audios: list[EntryAudioOut] = Field(default_factory=list)


class EntryCreateIn(BaseModel):
    question_id: UUID | None = None
    body: str = Field(min_length=1, max_length=10_000)
    photo_storage_keys: list[str] = Field(default_factory=list, max_length=5)
    video_attachments: list[MediaInput] = Field(default_factory=list, max_length=1)
    audio_attachments: list[MediaInput] = Field(default_factory=list, max_length=3)
    written_at: datetime | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    place_name: str | None = Field(default=None, max_length=255)
    weather: str | None = Field(default=None, max_length=64)


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
