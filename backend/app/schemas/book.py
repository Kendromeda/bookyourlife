from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

BookTone = Literal[
    "poetic",
    "honest",
    "minimalist",
    "cinematic",
    "funny",
    "deeply_reflective",
]
BookImageMode = Literal["abstract", "photo_inspired", "none"]
BookStatus = Literal["queued", "processing", "done", "failed"]


class BookPreviewRequest(BaseModel):
    period_start: datetime
    period_end: datetime
    tone: BookTone = "poetic"
    image_mode: BookImageMode = "abstract"
    include_voice_transcripts: bool = False

    @model_validator(mode="after")
    def validate_period(self) -> "BookPreviewRequest":
        if self.period_end <= self.period_start:
            raise ValueError("period_end must be after period_start")
        return self


class BookPreviewCreateResponse(BaseModel):
    book_id: UUID


class BookPreviewChapter(BaseModel):
    title: str
    narrative: str
    source_entry_ids: list[str] = Field(default_factory=list)
    image_url: str | None = None


class BookPreviewMediaItem(BaseModel):
    type: Literal["photo", "video", "audio"]
    url: str
    entry_id: str
    caption: str | None = None
    transcript: str | None = None


class BookPreviewResponse(BaseModel):
    id: UUID
    status: BookStatus
    tone: str
    image_mode: str
    include_voice_transcripts: bool
    period_start: datetime | None = None
    period_end: datetime | None = None
    title: str | None = None
    cover_image_url: str | None = None
    opening_letter: str | None = None
    chapters: list[BookPreviewChapter] = Field(default_factory=list)
    media_pages: list[BookPreviewMediaItem] = Field(default_factory=list)
    reflection: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
