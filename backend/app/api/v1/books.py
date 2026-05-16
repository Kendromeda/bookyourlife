from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.deps import CurrentUser, SessionDep
from app.models.book import Book
from app.schemas.book import (
    BookIllustrationUpdate,
    BookPreviewCreateResponse,
    BookPreviewRequest,
    BookPreviewResponse,
    BookTweaksUpdate,
)
from app.tasks.book_gen import generate_book

router = APIRouter()


async def _load_book(book_id: UUID, user_id: UUID, session) -> Book:
    book = (
        await session.execute(select(Book).where(Book.id == book_id, Book.user_id == user_id))
    ).scalar_one_or_none()
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book preview not found")
    return book


def _serialize(book: Book) -> BookPreviewResponse:
    data = book.preview_data or {}
    return BookPreviewResponse(
        id=book.id,
        status=book.status,  # type: ignore[arg-type]
        tone=book.style,
        image_mode=book.image_mode,
        include_voice_transcripts=book.include_voice_transcripts,
        period_start=book.period_start,
        period_end=book.period_end,
        title=book.title,
        cover_image_url=book.cover_image_url,
        opening_letter=book.opening_letter,
        chapters=data.get("chapters", []),
        media_pages=data.get("media_pages", []),
        reflection=data.get("reflection", {}),
        error=book.error,
        illustrations=book.illustrations or {},
        tweaks=book.tweaks or {},
    )


@router.post(
    "/previews",
    response_model=BookPreviewCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_book_preview(
    payload: BookPreviewRequest,
    user: CurrentUser,
    session: SessionDep,
) -> BookPreviewCreateResponse:
    book = Book(
        user_id=user.id,
        timeframe=payload.period_start.strftime("%Y-%m"),
        style=payload.tone,
        status="queued",
        image_mode=payload.image_mode,
        include_voice_transcripts=payload.include_voice_transcripts,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    session.add(book)
    await session.commit()
    await session.refresh(book)

    try:
        generate_book.delay(str(book.id))
    except Exception as exc:
        book.status = "failed"
        book.error = f"Book queue unavailable: {exc}"
        await session.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Book queue unavailable",
        ) from exc

    return BookPreviewCreateResponse(book_id=book.id)


@router.get("/previews/{book_id}", response_model=BookPreviewResponse)
async def get_book_preview(
    book_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> BookPreviewResponse:
    book = await _load_book(book_id, user.id, session)
    return _serialize(book)


@router.patch("/previews/{book_id}/illustrations", response_model=BookPreviewResponse)
async def patch_book_illustration(
    book_id: UUID,
    payload: BookIllustrationUpdate,
    user: CurrentUser,
    session: SessionDep,
) -> BookPreviewResponse:
    """Set or clear a single illustration slot.

    Mutates the JSONB dict in place — `flag_modified` is required because
    SQLAlchemy doesn't track in-place mutations on JSONB by default.
    """
    book = await _load_book(book_id, user.id, session)
    illustrations = dict(book.illustrations or {})
    if payload.storage_key is None:
        illustrations.pop(payload.slot_id, None)
    else:
        entry: dict = {"storage_key": payload.storage_key}
        if payload.crop is not None:
            entry["crop"] = payload.crop
        illustrations[payload.slot_id] = entry
    book.illustrations = illustrations
    flag_modified(book, "illustrations")
    await session.commit()
    await session.refresh(book)
    return _serialize(book)


@router.patch("/previews/{book_id}/tweaks", response_model=BookPreviewResponse)
async def patch_book_tweaks(
    book_id: UUID,
    payload: BookTweaksUpdate,
    user: CurrentUser,
    session: SessionDep,
) -> BookPreviewResponse:
    """Partial-update viewer tweaks (paper / type / ribbon / surface / illustrations_enabled)."""
    book = await _load_book(book_id, user.id, session)
    tweaks = dict(book.tweaks or {})
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            tweaks.pop(field, None)
        else:
            tweaks[field] = value
    book.tweaks = tweaks
    flag_modified(book, "tweaks")
    await session.commit()
    await session.refresh(book)
    return _serialize(book)
