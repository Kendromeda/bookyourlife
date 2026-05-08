from datetime import datetime
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import NoResultFound

from app.deps import CurrentUser, SessionDep
from app.schemas.entry import EntryCreateIn, EntryListOut, EntryOut, EntryUpdateIn
from app.services import entries as entries_service
from app.services.storage.r2 import get_r2_storage
from app.tasks.index_entry import index_entry as index_entry_task

router = APIRouter()
logger = structlog.get_logger()


@router.get("", response_model=EntryListOut)
async def list_entries(
    user: CurrentUser,
    session: SessionDep,
    limit: int = Query(20, ge=1, le=100),
    cursor: datetime | None = None,
) -> EntryListOut:
    items = await entries_service.list_entries(
        session, user_id=user.id, limit=limit, cursor=cursor
    )
    next_cursor = items[-1].written_at.isoformat() if len(items) == limit else None
    return EntryListOut(
        items=[_to_out(item) for item in items],
        next_cursor=next_cursor,
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
    try:
        entry = await entries_service.update_entry_body(
            session, user_id=user.id, entry_id=entry_id, body=payload.body
        )
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found") from None
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
