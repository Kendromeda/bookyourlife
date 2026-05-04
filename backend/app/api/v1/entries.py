from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import NoResultFound

from app.deps import CurrentUser, SessionDep
from app.schemas.entry import EntryCreateIn, EntryListOut, EntryOut, EntryUpdateIn
from app.services import entries as entries_service
from app.services.storage.r2 import get_r2_storage
from app.tasks.index_entry import index_entry as index_entry_task

router = APIRouter()


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
        written_at=payload.written_at,
    )
    # Schedule async embedding (Phase 2 picks up; stub aman dipanggil sekarang).
    index_entry_task.delay(str(entry.id))
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
    storage = get_r2_storage()
    return EntryOut(
        id=entry.id,
        user_id=entry.user_id,
        question_id=entry.question_id,
        body=entry.body,
        emotion_tags=entry.emotion_tags,
        written_at=entry.written_at,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        photos=[
            {  # type: ignore[list-item]
                "id": p.id,
                "storage_key": storage.public_url(p.storage_key),
                "position": p.position,
            }
            for p in (entry.photos or [])
        ],
    )
