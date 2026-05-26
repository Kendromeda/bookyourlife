from datetime import date, datetime
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
BookGenerationMode = Literal["illustrated", "photo_only", "mixed"]
BookStylePreset = Literal["watercolor", "pencil", "vintage", "anime"]
BookCoverMode = Literal["ai_mood", "best_photo"]
BookGenerationStatus = Literal["queued", "processing", "completed", "failed", "cancelled"]


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
    # One short italic-worthy line drawn from the chapter, used for the
    # pull-quote spread in the viewer. Optional for backward compatibility
    # with previews generated before this field was introduced.
    pull_quote: str | None = None


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
    illustrations: dict[str, Any] = Field(default_factory=dict)
    tweaks: dict[str, Any] = Field(default_factory=dict)


class BookIllustrationUpdate(BaseModel):
    """Set or clear a single illustration slot.

    `storage_key=None` clears the slot. `crop` is a free-form dict the
    frontend uses for its image reframe state — backend only stores it.
    """

    slot_id: str = Field(min_length=1, max_length=64)
    storage_key: str | None = Field(default=None, max_length=512)
    crop: dict[str, Any] | None = None


class BookTweaksUpdate(BaseModel):
    """Partial tweak update — any unset field leaves the existing value alone."""

    paper: str | None = Field(default=None, max_length=32)
    type: str | None = Field(default=None, max_length=32)
    ribbon: str | None = Field(default=None, max_length=32)
    surface: str | None = Field(default=None, max_length=32)
    illustrations_enabled: bool | None = None


class BookGenerateRequest(BaseModel):
    date_start: date
    date_end: date
    mode: BookGenerationMode = "illustrated"
    style_preset: BookStylePreset = "watercolor"
    cover_mode: BookCoverMode = "ai_mood"
    include_voice_transcripts: bool = True
    illustrated_required: bool = False
    # Opt-in: run user photos through Flux img2img with the chosen style
    # preset. Off by default because it adds ~$0.04 per photo and ~20 s
    # latency per image to the pipeline.
    style_transfer_photos: bool = False
    custom_title: str | None = Field(default=None, max_length=120)
    dedication: str | None = Field(default=None, max_length=1_000)

    @model_validator(mode="after")
    def validate_date_range(self) -> "BookGenerateRequest":
        if self.date_end < self.date_start:
            raise ValueError("date_end must be on or after date_start")
        if self.illustrated_required and self.mode == "photo_only":
            raise ValueError("illustrated_required requires illustrated or mixed mode")
        if self.style_transfer_photos and self.mode == "photo_only":
            raise ValueError("style_transfer_photos requires illustrated or mixed mode")
        return self


class BookGenerateResponse(BaseModel):
    book_id: UUID
    status: BookGenerationStatus
    estimated_minutes: int


class BookGenerationDetail(BaseModel):
    book_id: UUID
    status: BookGenerationStatus
    progress: int
    current_stage: str | None = None
    generated_title: str | None = None
    subtitle: str | None = None
    theme_summary: str | None = None
    pdf_url: str | None = None
    cover_url: str | None = None
    error_message: str | None = None


class BookGenerationListResponse(BaseModel):
    items: list[BookGenerationDetail] = Field(default_factory=list)


class BookRegenerateAssetsRequest(BaseModel):
    """Re-run S5 image generation.

    Omit `asset_ids` to retry every asset currently in failed /
    failed_fallback state. Partial retries are reserved for a future
    pipeline path and currently return 400.
    """

    asset_ids: list[UUID] = Field(default_factory=list)


class BookRegenerateAssetsResponse(BaseModel):
    book_id: UUID
    requeued: int
    status: BookGenerationStatus
    current_stage: str | None = None


class BookStageEvent(BaseModel):
    """One event emitted by the SSE stream during book generation."""

    book_id: UUID
    status: BookGenerationStatus
    progress: int
    current_stage: str | None = None
    error_message: str | None = None
    pdf_url: str | None = None
    cover_url: str | None = None
