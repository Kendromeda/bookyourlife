"""add book preview fields

Revision ID: 0011_book_preview_fields
Revises: 0010_user_signup_fields
Create Date: 2026-05-14
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011_book_preview_fields"
down_revision: str | Sequence[str] | None = "0010_user_signup_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS title VARCHAR(255)")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(512)")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS opening_letter TEXT")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS preview_data JSONB")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS error TEXT")
    op.execute(
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS image_mode VARCHAR(32) "
        "NOT NULL DEFAULT 'abstract'"
    )
    op.execute(
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS include_voice_transcripts BOOLEAN "
        "NOT NULL DEFAULT false"
    )
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS period_start TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS period_end TIMESTAMP WITH TIME ZONE")


def downgrade() -> None:
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS period_end")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS period_start")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS include_voice_transcripts")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS image_mode")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS error")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS preview_data")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS opening_letter")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS cover_image_url")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS title")
