"""book illustrations + tweaks JSONB columns

Revision ID: 0011_book_illustrations_tweaks
Revises: 0010_user_signup_fields
Create Date: 2026-05-16
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011_book_illustrations_tweaks"
down_revision: str | Sequence[str] | None = "0010_user_signup_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS illustrations JSONB NOT NULL DEFAULT '{}'::jsonb"
    )
    op.execute(
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS tweaks JSONB NOT NULL DEFAULT '{}'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS tweaks")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS illustrations")
