from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entry import Entry
from app.models.question import Question


async def latest_question_for_today(
    session: AsyncSession, *, user_id: UUID, now: datetime | None = None
) -> Question | None:
    now = now or datetime.now(tz=timezone.utc)
    since = now - timedelta(hours=24)
    stmt = (
        select(Question)
        .where(Question.user_id == user_id, Question.asked_at >= since)
        .order_by(desc(Question.asked_at))
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def recent_question_texts(
    session: AsyncSession, *, user_id: UUID, days: int = 30
) -> list[str]:
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)
    stmt = (
        select(Question.text)
        .where(Question.user_id == user_id, Question.asked_at >= since)
        .order_by(desc(Question.asked_at))
    )
    return [row for row in (await session.execute(stmt)).scalars().all()]


async def recent_entry_bodies(
    session: AsyncSession, *, user_id: UUID, limit: int = 10
) -> list[str]:
    stmt = (
        select(Entry.body)
        .where(Entry.user_id == user_id)
        .order_by(desc(Entry.written_at))
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def persist_question(
    session: AsyncSession,
    *,
    user_id: UUID,
    text: str,
    source: str,
    context_entry_ids: list[UUID],
    asked_at: datetime | None = None,
) -> Question:
    question = Question(
        user_id=user_id,
        text=text,
        source=source,
        context_entry_ids=context_entry_ids,
        asked_at=asked_at or datetime.now(tz=timezone.utc),
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)
    return question


async def mark_skipped(session: AsyncSession, *, user_id: UUID, question_id: UUID) -> None:
    stmt = select(Question).where(Question.id == question_id, Question.user_id == user_id)
    question = (await session.execute(stmt)).scalar_one_or_none()
    if question is None:
        raise NoResultFound(str(question_id))
    # Skip = tandai sudah dijawab dengan null entry agar tidak ditampilkan ulang.
    # answered_entry_id tetap null tapi asked_at tidak diubah; kita pakai field lain di v2.
    # Untuk Phase 1 cukup hapus, sehingga GET /questions/today akan generate baru.
    await session.delete(question)
    await session.commit()
