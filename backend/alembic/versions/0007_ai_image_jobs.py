"""add ai_image_jobs table

Revision ID: 0007_ai_image_jobs
Revises: 0006_entry_media
Create Date: 2026-05-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007_ai_image_jobs"
down_revision: str | Sequence[str] | None = "0006_entry_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    status_enum = sa.Enum(
        "pending",
        "processing",
        "done",
        "failed",
        name="ai_image_job_status",
    )
    status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "ai_image_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", status_enum, nullable=False, server_default="pending"),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.String(512), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ai_image_jobs_user_id", "ai_image_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_image_jobs_user_id", table_name="ai_image_jobs")
    op.drop_table("ai_image_jobs")
    sa.Enum(name="ai_image_job_status").drop(op.get_bind(), checkfirst=True)
