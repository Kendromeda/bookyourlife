"""add entry title column

Revision ID: 0008_entry_title
Revises: 0007_ai_image_jobs
Create Date: 2026-05-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_entry_title"
down_revision: str | Sequence[str] | None = "0007_ai_image_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE entries ADD COLUMN IF NOT EXISTS title VARCHAR(255)")


def downgrade() -> None:
    op.execute("ALTER TABLE entries DROP COLUMN IF EXISTS title")
