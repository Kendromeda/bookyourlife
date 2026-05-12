from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models._base import Base, TimestampMixin, UUIDMixin


class Entry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "entries"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("questions.id"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    body_embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)
    emotion_tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list, server_default="{}"
    )
    written_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    place_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    weather: Mapped[str | None] = mapped_column(String(64), nullable=True)

    photos: Mapped[list["EntryPhoto"]] = relationship(
        "EntryPhoto",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="EntryPhoto.position",
    )
    videos: Mapped[list["EntryVideo"]] = relationship(
        "EntryVideo",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="EntryVideo.position",
    )
    audios: Mapped[list["EntryAudio"]] = relationship(
        "EntryAudio",
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="EntryAudio.position",
    )


class EntryPhoto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "entry_photos"

    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("entries.id", ondelete="CASCADE"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    entry: Mapped["Entry"] = relationship("Entry", back_populates="photos")


class EntryVideo(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "entry_videos"

    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("entries.id", ondelete="CASCADE"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    entry: Mapped["Entry"] = relationship("Entry", back_populates="videos")


class EntryAudio(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "entry_audios"

    entry_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("entries.id", ondelete="CASCADE"), nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    entry: Mapped["Entry"] = relationship("Entry", back_populates="audios")
