"""merge book preview migration heads

Revision ID: 0012_merge_book_preview_heads
Revises: 0011_book_preview_fields, 0011_book_illustrations_tweaks
Create Date: 2026-05-16
"""

from collections.abc import Sequence

revision: str = "0012_merge_book_preview_heads"
down_revision: str | Sequence[str] | None = (
    "0011_book_preview_fields",
    "0011_book_illustrations_tweaks",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
