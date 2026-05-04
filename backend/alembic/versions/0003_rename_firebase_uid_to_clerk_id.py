"""rename firebase_uid to clerk_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-01
"""

from alembic import op

revision = "0003"
down_revision = "0002_device_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "firebase_uid", new_column_name="clerk_id")


def downgrade() -> None:
    op.alter_column("users", "clerk_id", new_column_name="firebase_uid")
