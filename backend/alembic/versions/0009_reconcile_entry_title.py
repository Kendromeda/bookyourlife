"""reconcile entry title column

Revision ID: 0009_reconcile_entry_title
Revises: 0008_entry_title
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009_reconcile_entry_title"
down_revision: str | Sequence[str] | None = "0008_entry_title"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE entries ADD COLUMN IF NOT EXISTS title VARCHAR(255)")


def downgrade() -> None:
    # This migration only repairs databases that were stamped without the
    # physical column. The column itself belongs to 0008_entry_title.
    pass
