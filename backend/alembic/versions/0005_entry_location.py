"""add entry location and weather

Revision ID: 0005_entry_location
Revises: 0004_user_preferred_language
Create Date: 2026-05-08
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_entry_location"
down_revision: str | Sequence[str] | None = "0004_user_preferred_language"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("entries", sa.Column("lat", sa.Float(), nullable=True))
    op.add_column("entries", sa.Column("lng", sa.Float(), nullable=True))
    op.add_column("entries", sa.Column("place_name", sa.String(255), nullable=True))
    op.add_column("entries", sa.Column("weather", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("entries", "weather")
    op.drop_column("entries", "place_name")
    op.drop_column("entries", "lng")
    op.drop_column("entries", "lat")
