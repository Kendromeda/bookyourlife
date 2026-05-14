from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, SessionDep
from app.models.book import Book
from app.schemas.book import (
    BookPreviewCreateResponse,
    BookPreviewRequest,
    BookPreviewResponse,
)
from app.tasks.book_gen import generate_book

router = APIRouter()


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
    book = (
        await session.execute(select(Book).where(Book.id == book_id, Book.user_id == user.id))
    ).scalar_one_or_none()
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book preview not found")

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
    )
