from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class MediaUpdate(BaseModel):
    """One attachment in an update payload.

    Either `id` is set (keep an existing attachment with this id) or
    `storage_key` is set (create a new attachment with this key). When
    both are provided, `id` wins.
    """

    id: UUID | None = None
    storage_key: str | None = None
    duration_seconds: int | None = None

    @model_validator(mode="after")
    def require_id_or_key(self) -> "MediaUpdate":
        if self.id is None and not self.storage_key:
            raise ValueError("MediaUpdate requires id or storage_key")
        return self


class PhotoUpdate(BaseModel):
    """Photo update entry: id (keep) or storage_key (create)."""

    id: UUID | None = None
    storage_key: str | None = None

    @model_validator(mode="after")
    def require_id_or_key(self) -> "PhotoUpdate":
        if self.id is None and not self.storage_key:
            raise ValueError("PhotoUpdate requires id or storage_key")
        return self


class EntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    question_id: UUID | None
    title: str | None = None
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
    title: str | None = Field(default=None, max_length=255)
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
    """Full update payload. Attachments use diff strategy: items with `id`
    keep the existing attachment; items with only `storage_key` create new.
    Items not listed are deleted.
    """

    title: str | None = Field(default=None, max_length=255)
    body: str = Field(min_length=1, max_length=10_000)
    written_at: datetime | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    place_name: str | None = Field(default=None, max_length=255)
    weather: str | None = Field(default=None, max_length=64)
    photos: list[PhotoUpdate] = Field(default_factory=list, max_length=5)
    videos: list[MediaUpdate] = Field(default_factory=list, max_length=1)
    audios: list[MediaUpdate] = Field(default_factory=list, max_length=3)


class EntryListOut(BaseModel):
    items: list[EntryOut]
    next_cursor: str | None = None


class EntryNeighborsOut(BaseModel):
    older: EntryOut | None = None
    newer: EntryOut | None = None


class PresignedUploadOut(BaseModel):
    upload_url: str
    storage_key: str
    expires_in_seconds: int


class DirectUploadOut(BaseModel):
    storage_key: str
    public_url: str
