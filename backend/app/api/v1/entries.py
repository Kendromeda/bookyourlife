from datetime import UTC, date, datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import NoResultFound

from app.deps import CurrentUser, SessionDep
from app.schemas.entry import (
    EntryCreateIn,
    EntryListOut,
    EntryNeighborsOut,
    EntryOut,
    EntryUpdateIn,
)
from app.services import entries as entries_service
from app.services.storage.r2 import get_r2_storage
from app.tasks.index_entry import index_entry as index_entry_task

router = APIRouter()
logger = structlog.get_logger()


@router.get("", response_model=EntryListOut)
async def list_entries(
    user: CurrentUser,
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: datetime | None = None,
    on_date: Annotated[date | None, Query(alias="date")] = None,
    date_from: Annotated[datetime | None, Query(alias="from")] = None,
    date_to: Annotated[datetime | None, Query(alias="to")] = None,
) -> EntryListOut:
    # Caller may either pass an explicit [from, to) ISO range (preferred —
    # lets client align to local-time day boundary) or a single `date`
    # which we expand to a UTC-day range as a convenience fallback.
    if date_from is None and date_to is None and on_date is not None:
        date_from = datetime.combine(on_date, datetime.min.time(), tzinfo=UTC)
        date_to = date_from + timedelta(days=1)

    items = await entries_service.list_entries(
        session,
        user_id=user.id,
        limit=limit,
        cursor=cursor,
        date_from=date_from,
        date_to=date_to,
    )
    next_cursor = items[-1].written_at.isoformat() if len(items) == limit else None
    return EntryListOut(
        items=[_to_out(item) for item in items],
        next_cursor=next_cursor,
    )


@router.get("/{entry_id}", response_model=EntryOut)
async def get_entry(
    entry_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> EntryOut:
    try:
        entry = await entries_service.get_entry(session, user_id=user.id, entry_id=entry_id)
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found") from None
    return _to_out(entry)


@router.get("/{entry_id}/neighbors", response_model=EntryNeighborsOut)
async def get_entry_neighbors(
    entry_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> EntryNeighborsOut:
    try:
        older, newer = await entries_service.get_entry_neighbors(
            session, user_id=user.id, entry_id=entry_id
        )
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found") from None
    return EntryNeighborsOut(
        older=_to_out(older) if older else None,
        newer=_to_out(newer) if newer else None,
    )


@router.post("", response_model=EntryOut, status_code=status.HTTP_201_CREATED)
async def create_entry(
    payload: EntryCreateIn,
    user: CurrentUser,
    session: SessionDep,
) -> EntryOut:
    entry = await entries_service.create_entry(
        session,
        user_id=user.id,
        title=payload.title,
        body=payload.body,
        question_id=payload.question_id,
        photo_storage_keys=payload.photo_storage_keys,
        video_attachments=[
            entries_service.MediaAttachment(
                storage_key=item.storage_key,
                duration_seconds=item.duration_seconds,
            )
            for item in payload.video_attachments
        ],
        audio_attachments=[
            entries_service.MediaAttachment(
                storage_key=item.storage_key,
                duration_seconds=item.duration_seconds,
            )
            for item in payload.audio_attachments
        ],
        written_at=payload.written_at,
        lat=payload.lat,
        lng=payload.lng,
        place_name=payload.place_name,
        weather=payload.weather,
    )
    try:
        index_entry_task.delay(str(entry.id))
    except Exception as exc:
        logger.warning("index_entry enqueue failed", entry_id=str(entry.id), error=str(exc))
    return _to_out(entry)


@router.patch("/{entry_id}", response_model=EntryOut)
async def update_entry(
    entry_id: UUID,
    payload: EntryUpdateIn,
    user: CurrentUser,
    session: SessionDep,
) -> EntryOut:
    # Only pass location/weather fields if explicitly present in payload.
    # Allows clients to leave fields untouched.
    fields_set = payload.model_fields_set
    optional_kwargs: dict = {}
    if "lat" in fields_set:
        optional_kwargs["lat"] = payload.lat
    if "lng" in fields_set:
        optional_kwargs["lng"] = payload.lng
    if "place_name" in fields_set:
        optional_kwargs["place_name"] = payload.place_name
    if "weather" in fields_set:
        optional_kwargs["weather"] = payload.weather

    try:
        entry = await entries_service.update_entry(
            session,
            user_id=user.id,
            entry_id=entry_id,
            title=payload.title,
            body=payload.body,
            written_at=payload.written_at,
            photos=[
                entries_service.PhotoUpdateItem(id=item.id, storage_key=item.storage_key)
                for item in payload.photos
            ],
            videos=[
                entries_service.MediaUpdateItem(
                    id=item.id,
                    storage_key=item.storage_key,
                    duration_seconds=item.duration_seconds,
                )
                for item in payload.videos
            ],
            audios=[
                entries_service.MediaUpdateItem(
                    id=item.id,
                    storage_key=item.storage_key,
                    duration_seconds=item.duration_seconds,
                )
                for item in payload.audios
            ],
            **optional_kwargs,
        )
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found") from None
    try:
        index_entry_task.delay(str(entry.id))
    except Exception as exc:
        logger.warning("index_entry enqueue failed", entry_id=str(entry.id), error=str(exc))
    return _to_out(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> None:
    try:
        await entries_service.delete_entry(session, user_id=user.id, entry_id=entry_id)
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found") from None


def _to_out(entry) -> EntryOut:  # type: ignore[no-untyped-def]
    has_media = bool(entry.photos or entry.videos or entry.audios)
    storage = get_r2_storage() if has_media else None
    return EntryOut(
        id=entry.id,
        user_id=entry.user_id,
        question_id=entry.question_id,
        title=entry.title,
        body=entry.body,
        emotion_tags=entry.emotion_tags,
        written_at=entry.written_at,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        lat=entry.lat,
        lng=entry.lng,
        place_name=entry.place_name,
        weather=entry.weather,
        photos=[
            {  # type: ignore[list-item]
                "id": p.id,
                "storage_key": storage.public_url(p.storage_key) if storage else p.storage_key,
                "position": p.position,
            }
            for p in (entry.photos or [])
        ],
        videos=[
            {  # type: ignore[list-item]
                "id": v.id,
                "storage_key": storage.public_url(v.storage_key) if storage else v.storage_key,
                "duration_seconds": v.duration_seconds,
                "position": v.position,
            }
            for v in (entry.videos or [])
        ],
        audios=[
            {  # type: ignore[list-item]
                "id": a.id,
                "storage_key": storage.public_url(a.storage_key) if storage else a.storage_key,
                "duration_seconds": a.duration_seconds,
                "transcript": a.transcript,
                "position": a.position,
            }
            for a in (entry.audios or [])
        ],
    )
