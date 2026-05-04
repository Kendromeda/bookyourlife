from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models._base import Base, TimestampMixin, UUIDMixin


class Order(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orders"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    book_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("books.id"), nullable=False
    )
    format: Mapped[str] = mapped_column(String(16), nullable=False)  # hardcover | paperback
    shipping_address: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    lulu_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
