"""add ai_image_jobs table

Revision ID: 0007_ai_image_jobs
Revises: 0006_entry_media
Create Date: 2026-05-10
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007_ai_image_jobs"
down_revision: str | Sequence[str] | None = "0006_entry_media"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'ai_image_job_status'
            ) THEN
                CREATE TYPE ai_image_job_status AS ENUM (
                    'pending',
                    'processing',
                    'done',
                    'failed'
                );
            END IF;
        END
        $$;
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ai_image_jobs (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status ai_image_job_status NOT NULL DEFAULT 'pending',
            prompt TEXT NOT NULL,
            storage_key VARCHAR(512),
            error TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ai_image_jobs_user_id ON ai_image_jobs (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ai_image_jobs_user_id")
    op.execute("DROP TABLE IF EXISTS ai_image_jobs")
    op.execute("DROP TYPE IF EXISTS ai_image_job_status")
