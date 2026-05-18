"""book generation pipeline tables

Revision ID: 0013_book_generation_pipeline
Revises: 0012_merge_book_preview_heads
Create Date: 2026-05-18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_book_generation_pipeline"
down_revision: str | Sequence[str] | None = "0012_merge_book_preview_heads"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS progress SMALLINT NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS current_stage VARCHAR(32)")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS pdf_r2_key VARCHAR(512)")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_r2_key VARCHAR(512)")
    op.execute(
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb"
    )
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS error_message TEXT")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE")

    op.create_table(
        "book_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("stage", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempt", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("book_id", "stage", name="uq_book_jobs_book_stage"),
    )
    op.create_index("ix_book_jobs_book_id", "book_jobs", ["book_id"])

    op.create_table(
        "book_plans",
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("generated_title", sa.Text(), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("theme_summary", sa.Text(), nullable=False),
        sa.Column("dominant_mood", sa.String(32), nullable=True),
        sa.Column("chapter_strategy", sa.String(32), nullable=False),
        sa.Column("plan", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "generated_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("asset_type", sa.String(32), nullable=False),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("r2_key", sa.String(512), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("fallback_strategy", sa.String(64), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("book_id", "asset_type", "ref_id", name="uq_generated_assets_book_type_ref"),
    )
    op.create_index("ix_generated_assets_book_id", "generated_assets", ["book_id"])

    op.create_table(
        "book_chapters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("part_label", sa.Text(), nullable=True),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("theme", sa.Text(), nullable=True),
        sa.Column("date_range_start", sa.Date(), nullable=True),
        sa.Column("date_range_end", sa.Date(), nullable=True),
        sa.Column("intro_text", sa.Text(), nullable=True),
        sa.Column(
            "cover_asset_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generated_assets.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("book_id", "position", name="uq_book_chapters_book_position"),
    )
    op.create_index("ix_book_chapters_book_id", "book_chapters", ["book_id"])

    op.create_table(
        "book_chapter_entries",
        sa.Column(
            "chapter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("book_chapters.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entries.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("position", sa.SmallInteger(), nullable=False),
    )

    op.create_table(
        "entry_enhancements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("layout_template", sa.SmallInteger(), nullable=False),
        sa.Column("pull_quote", sa.Text(), nullable=True),
        sa.Column("pull_quote_position", sa.String(16), nullable=True),
        sa.Column("photo_captions", postgresql.JSONB(), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("book_id", "entry_id", name="uq_entry_enhancements_book_entry"),
    )
    op.create_index("ix_entry_enhancements_book_id", "entry_enhancements", ["book_id"])


def downgrade() -> None:
    op.drop_index("ix_entry_enhancements_book_id", table_name="entry_enhancements")
    op.drop_table("entry_enhancements")
    op.drop_table("book_chapter_entries")
    op.drop_index("ix_book_chapters_book_id", table_name="book_chapters")
    op.drop_table("book_chapters")
    op.drop_index("ix_generated_assets_book_id", table_name="generated_assets")
    op.drop_table("generated_assets")
    op.drop_table("book_plans")
    op.drop_index("ix_book_jobs_book_id", table_name="book_jobs")
    op.drop_table("book_jobs")

    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS completed_at")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS started_at")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS error_message")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS config")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS cover_r2_key")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS pdf_r2_key")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS current_stage")
    op.execute("ALTER TABLE books DROP COLUMN IF EXISTS progress")
