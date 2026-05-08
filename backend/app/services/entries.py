from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import desc, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entry import Entry, EntryAudio, EntryPhoto, EntryVideo

logger = structlog.get_logger()


@dataclass
class MediaAttachment:
    storage_key: str
    duration_seconds: int | None = None


_ENTRY_LOAD_OPTIONS = (
    selectinload(Entry.photos),
    selectinload(Entry.videos),
    selectinload(Entry.audios),
)


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
        .options(*_ENTRY_LOAD_OPTIONS)
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
        .options(*_ENTRY_LOAD_OPTIONS)
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
    video_attachments: list[MediaAttachment],
    audio_attachments: list[MediaAttachment],
    written_at: datetime | None,
    lat: float | None = None,
    lng: float | None = None,
    place_name: str | None = None,
    weather: str | None = None,
) -> Entry:
    entry = Entry(
        user_id=user_id,
        body=body,
        question_id=question_id,
        written_at=written_at or datetime.now(tz=UTC),
        lat=lat,
        lng=lng,
        place_name=place_name,
        weather=weather,
    )
    session.add(entry)
    await session.flush()

    for index, key in enumerate(photo_storage_keys):
        session.add(EntryPhoto(entry_id=entry.id, storage_key=key, position=index))

    for index, video in enumerate(video_attachments):
        session.add(
            EntryVideo(
                entry_id=entry.id,
                storage_key=video.storage_key,
                duration_seconds=video.duration_seconds,
                position=index,
            )
        )

    audio_records: list[EntryAudio] = []
    for index, audio in enumerate(audio_attachments):
        record = EntryAudio(
            entry_id=entry.id,
            storage_key=audio.storage_key,
            duration_seconds=audio.duration_seconds,
            position=index,
        )
        session.add(record)
        audio_records.append(record)

    await session.commit()
    # Trigger transcription asynchronously after commit
    if audio_records:
        from app.tasks.transcribe import transcribe_audio_task  # local import to avoid cycle

        await session.refresh(entry, attribute_names=["audios"])
        for record in entry.audios:
            try:
                transcribe_audio_task.delay(str(record.id))
            except Exception as exc:
                logger.warning(
                    "transcribe enqueue failed",
                    audio_id=str(record.id),
                    error=str(exc),
                )

    return await get_entry(session, user_id=user_id, entry_id=entry.id)


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
