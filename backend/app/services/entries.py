from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entry import Entry, EntryPhoto


async def list_entries(
    session: AsyncSession,
    *,
    user_id: UUID,
    limit: int = 20,
    cursor: datetime | None = None,
) -> list[Entry]:
    stmt = (
        select(Entry)
        .where(Entry.user_id == user_id)
        .options(selectinload(Entry.photos))
        .order_by(desc(Entry.written_at))
        .limit(limit)
    )
    if cursor is not None:
        stmt = stmt.where(Entry.written_at < cursor)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_entry(session: AsyncSession, *, user_id: UUID, entry_id: UUID) -> Entry:
    stmt = (
        select(Entry)
        .where(Entry.id == entry_id, Entry.user_id == user_id)
        .options(selectinload(Entry.photos))
    )
    entry = (await session.execute(stmt)).scalar_one_or_none()
    if entry is None:
        raise NoResultFound(str(entry_id))
    return entry


async def create_entry(
    session: AsyncSession,
    *,
    user_id: UUID,
    body: str,
    question_id: UUID | None,
    photo_storage_keys: list[str],
    written_at: datetime | None,
) -> Entry:
    entry = Entry(
        user_id=user_id,
        body=body,
        question_id=question_id,
        written_at=written_at or datetime.now(tz=timezone.utc),
    )
    session.add(entry)
    await session.flush()

    for index, key in enumerate(photo_storage_keys):
        session.add(EntryPhoto(entry_id=entry.id, storage_key=key, position=index))

    await session.commit()
    await session.refresh(entry)
    return entry


async def update_entry_body(
    session: AsyncSession, *, user_id: UUID, entry_id: UUID, body: str
) -> Entry:
    entry = await get_entry(session, user_id=user_id, entry_id=entry_id)
    entry.body = body
    await session.commit()
    await session.refresh(entry)
    return entry


async def delete_entry(session: AsyncSession, *, user_id: UUID, entry_id: UUID) -> None:
    entry = await get_entry(session, user_id=user_id, entry_id=entry_id)
    await session.delete(entry)
    await session.commit()
