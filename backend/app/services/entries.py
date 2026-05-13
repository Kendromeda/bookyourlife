from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entry import Entry, EntryAudio, EntryPhoto, EntryVideo


@dataclass
class MediaAttachment:
    storage_key: str
    duration_seconds: int | None = None


@dataclass
class PhotoUpdateItem:
    id: UUID | None
    storage_key: str | None


@dataclass
class MediaUpdateItem:
    id: UUID | None
    storage_key: str | None
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
    date_from: datetime | None = None,
    date_to: datetime | None = None,
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
    if date_from is not None:
        stmt = stmt.where(Entry.written_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Entry.written_at < date_to)
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


async def get_entry_neighbors(
    session: AsyncSession,
    *,
    user_id: UUID,
    entry_id: UUID,
) -> tuple[Entry | None, Entry | None]:
    """Return (older, newer) entries adjacent to the given one.

    Ordering matches list_entries (DESC by written_at): the older entry
    is the next one when scrolling further into the past; the newer one
    is more recent. Ties on written_at break by id to stay deterministic.
    """
    current = await get_entry(session, user_id=user_id, entry_id=entry_id)

    older_stmt = (
        select(Entry)
        .where(
            Entry.user_id == user_id,
            (Entry.written_at < current.written_at)
            | ((Entry.written_at == current.written_at) & (Entry.id < current.id)),
        )
        .options(*_ENTRY_LOAD_OPTIONS)
        .order_by(desc(Entry.written_at), desc(Entry.id))
        .limit(1)
    )
    newer_stmt = (
        select(Entry)
        .where(
            Entry.user_id == user_id,
            (Entry.written_at > current.written_at)
            | ((Entry.written_at == current.written_at) & (Entry.id > current.id)),
        )
        .options(*_ENTRY_LOAD_OPTIONS)
        .order_by(Entry.written_at, Entry.id)
        .limit(1)
    )
    older = (await session.execute(older_stmt)).scalar_one_or_none()
    newer = (await session.execute(newer_stmt)).scalar_one_or_none()
    return older, newer


async def create_entry(
    session: AsyncSession,
    *,
    user_id: UUID,
    body: str,
    title: str | None,
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
        title=title,
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

    for index, audio in enumerate(audio_attachments):
        session.add(
            EntryAudio(
                entry_id=entry.id,
                storage_key=audio.storage_key,
                duration_seconds=audio.duration_seconds,
                position=index,
            )
        )

    await session.commit()
    return await get_entry(session, user_id=user_id, entry_id=entry.id)


_UNSET: object = object()


async def update_entry(
    session: AsyncSession,
    *,
    user_id: UUID,
    entry_id: UUID,
    title: str | None,
    body: str,
    written_at: datetime | None = None,
    lat: float | None | object = _UNSET,
    lng: float | None | object = _UNSET,
    place_name: str | None | object = _UNSET,
    weather: str | None | object = _UNSET,
    photos: list[PhotoUpdateItem],
    videos: list[MediaUpdateItem],
    audios: list[MediaUpdateItem],
) -> Entry:
    """Full update with attachment diff.

    Items with `id` are kept (position may change); items with only
    `storage_key` are created; existing items not referenced are deleted.

    Location/weather fields use a sentinel default — only updated when
    the caller passes an explicit value (including None to clear).
    """
    entry = await get_entry(session, user_id=user_id, entry_id=entry_id)

    entry.title = title
    entry.body = body
    if written_at is not None:
        entry.written_at = written_at
    if lat is not _UNSET:
        entry.lat = lat  # type: ignore[assignment]
    if lng is not _UNSET:
        entry.lng = lng  # type: ignore[assignment]
    if place_name is not _UNSET:
        entry.place_name = place_name  # type: ignore[assignment]
    if weather is not _UNSET:
        entry.weather = weather  # type: ignore[assignment]

    _diff_photos(entry, photos)
    _diff_videos(entry, videos)
    _diff_audios(entry, audios)

    await session.commit()
    return await get_entry(session, user_id=user_id, entry_id=entry_id)


def _diff_photos(entry: Entry, items: list[PhotoUpdateItem]) -> None:
    existing_by_id = {p.id: p for p in entry.photos}
    keep_ids: set[UUID] = set()

    for index, item in enumerate(items):
        if item.id is not None and item.id in existing_by_id:
            existing_by_id[item.id].position = index
            keep_ids.add(item.id)
        elif item.storage_key:
            new_photo = EntryPhoto(
                entry_id=entry.id,
                storage_key=item.storage_key,
                position=index,
            )
            entry.photos.append(new_photo)

    for photo in list(entry.photos):
        if photo.id not in keep_ids and photo.id in existing_by_id:
            entry.photos.remove(photo)


def _diff_videos(entry: Entry, items: list[MediaUpdateItem]) -> None:
    existing_by_id = {v.id: v for v in entry.videos}
    keep_ids: set[UUID] = set()

    for index, item in enumerate(items):
        if item.id is not None and item.id in existing_by_id:
            existing_by_id[item.id].position = index
            keep_ids.add(item.id)
        elif item.storage_key:
            new_video = EntryVideo(
                entry_id=entry.id,
                storage_key=item.storage_key,
                duration_seconds=item.duration_seconds,
                position=index,
            )
            entry.videos.append(new_video)

    for video in list(entry.videos):
        if video.id not in keep_ids and video.id in existing_by_id:
            entry.videos.remove(video)


def _diff_audios(entry: Entry, items: list[MediaUpdateItem]) -> None:
    existing_by_id = {a.id: a for a in entry.audios}
    keep_ids: set[UUID] = set()

    for index, item in enumerate(items):
        if item.id is not None and item.id in existing_by_id:
            existing_by_id[item.id].position = index
            keep_ids.add(item.id)
        elif item.storage_key:
            new_audio = EntryAudio(
                entry_id=entry.id,
                storage_key=item.storage_key,
                duration_seconds=item.duration_seconds,
                position=index,
            )
            entry.audios.append(new_audio)

    for audio in list(entry.audios):
        if audio.id not in keep_ids and audio.id in existing_by_id:
            entry.audios.remove(audio)


async def delete_entry(session: AsyncSession, *, user_id: UUID, entry_id: UUID) -> None:
    entry = await get_entry(session, user_id=user_id, entry_id=entry_id)
    await session.delete(entry)
    await session.commit()
