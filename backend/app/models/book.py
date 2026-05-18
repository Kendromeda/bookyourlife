from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models._base import Base, TimestampMixin, UUIDMixin


class Book(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "books"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timeframe: Mapped[str] = mapped_column(String(16), nullable=False)  # 3m | 6m | lifetime
    style: Mapped[str] = mapped_column(String(32), nullable=False)  # poetic | casual | reflective
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    opening_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    preview_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    current_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    pdf_r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cover_r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    image_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="abstract")
    include_voice_transcripts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # User-supplied photos for slot ids in the viewer (frontispiece, plates,
    # author portrait, etc.). Shape: { slot_id: { storage_key, crop? } }.
    illustrations: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    # Per-book viewer styling: paper / type / ribbon / surface / illustrations_enabled.
    tweaks: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )


class Chapter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chapters"

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    narrative: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_entry_ids: Mapped[list[UUID]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), nullable=False, default=list, server_default="{}"
    )


class BookJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "book_jobs"
    __table_args__ = (UniqueConstraint("book_id", "stage", name="uq_book_jobs_book_stage"),)

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stage: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempt: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")


class BookPlan(Base):
    __tablename__ = "book_plans"

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        primary_key=True,
    )
    generated_title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme_summary: Mapped[str] = mapped_column(Text, nullable=False)
    dominant_mood: Mapped[str | None] = mapped_column(String(32), nullable=True)
    chapter_strategy: Mapped[str] = mapped_column(String(32), nullable=False)
    plan: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BookChapter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "book_chapters"
    __table_args__ = (
        UniqueConstraint("book_id", "position", name="uq_book_chapters_book_position"),
    )

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    part_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_range_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_range_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    intro_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_asset_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("generated_assets.id"), nullable=True
    )


class BookChapterEntry(Base):
    __tablename__ = "book_chapter_entries"

    chapter_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("book_chapters.id", ondelete="CASCADE"),
        primary_key=True,
    )
    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class EntryEnhancement(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "entry_enhancements"
    __table_args__ = (
        UniqueConstraint("book_id", "entry_id", name="uq_entry_enhancements_book_entry"),
    )

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("entries.id", ondelete="CASCADE"), nullable=False
    )
    layout_template: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    pull_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    pull_quote_position: Mapped[str | None] = mapped_column(String(16), nullable=True)
    photo_captions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)


class GeneratedAsset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "generated_assets"
    __table_args__ = (
        UniqueConstraint(
            "book_id", "asset_type", "ref_id", name="uq_generated_assets_book_type_ref"
        ),
    )

    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False)
    ref_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    r2_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    fallback_strategy: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
