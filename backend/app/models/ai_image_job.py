from enum import Enum
from uuid import UUID

from sqlalchemy import Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models._base import Base, TimestampMixin, UUIDMixin


class AiImageJobStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class AiImageJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_image_jobs"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[AiImageJobStatus] = mapped_column(
        SQLEnum(AiImageJobStatus, name="ai_image_job_status"),
        nullable=False,
        default=AiImageJobStatus.pending,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
