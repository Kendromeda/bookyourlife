"""add user signup fields (gender, birthday, journaling_goal)

Revision ID: 0010_user_signup_fields
Revises: 0009_reconcile_entry_title
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_user_signup_fields"
down_revision: str | Sequence[str] | None = "0009_reconcile_entry_title"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(32)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS journaling_goal VARCHAR(32)")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS journaling_goal")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS birthday")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS gender")
