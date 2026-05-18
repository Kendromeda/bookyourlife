from datetime import UTC, datetime, time, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm.attributes import flag_modified

from app.deps import CurrentUser, SessionDep
from app.models.book import Book, BookPlan
from app.schemas.book import (
    BookGenerateRequest,
    BookGenerateResponse,
    BookGenerationDetail,
    BookGenerationListResponse,
    BookGenerationStatus,
    BookIllustrationUpdate,
    BookPreviewCreateResponse,
    BookPreviewRequest,
    BookPreviewResponse,
    BookTweaksUpdate,
)
from app.services.storage.r2 import get_r2_storage
from app.tasks.book_gen import generate_book
from app.tasks.book_pipeline import generate_book_pipeline

router = APIRouter()

GENERATION_FLOW = "generation"
PREVIEW_FLOW = "preview"
GENERATION_ESTIMATED_MINUTES = 8
GENERATION_WORKER_INSPECT_TIMEOUT_SECONDS = 1.5


def _flow_value():  # type: ignore[no-untyped-def]
    return Book.config["flow"].astext


def _preview_filter():  # type: ignore[no-untyped-def]
    return func.coalesce(_flow_value(), PREVIEW_FLOW) != GENERATION_FLOW


def _generation_filter():  # type: ignore[no-untyped-def]
    return _flow_value() == GENERATION_FLOW


async def _load_book(book_id: UUID, user_id: UUID, session) -> Book:
    book = (
        await session.execute(
            select(Book).where(
                Book.id == book_id,
                Book.user_id == user_id,
                _preview_filter(),
            )
        )
    ).scalar_one_or_none()
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book preview not found")
    return book


async def _load_generation_book(book_id: UUID, user_id: UUID, session) -> Book:
    book = (
        await session.execute(
            select(Book).where(
                Book.id == book_id,
                Book.user_id == user_id,
                _generation_filter(),
            )
        )
    ).scalar_one_or_none()
    if book is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found")
    return book


def _serialize(book: Book) -> BookPreviewResponse:
    """Project a Book row into the API response.

    Illustrations are stored as bare R2 object keys in the database
    (mirrors entry_photos) and rewritten to public_url at response time
    so the frontend never has to compose CDN URLs. Storage_key stays on
    the wire too — needed for any future delete / re-upload flow.
    """
    data = book.preview_data or {}
    storage = None
    illustrations: dict = {}
    for slot_id, entry in (book.illustrations or {}).items():
        if not isinstance(entry, dict):
            continue
        key = entry.get("storage_key")
        if not key:
            continue
        # Tolerate legacy rows that stored a full URL under "storage_key"
        # (the pre-Phase-2 shape) — pass it through unchanged so old
        # books still render.
        if str(key).startswith("http"):
            public = key
        else:
            if storage is None:
                storage = get_r2_storage()
            public = storage.public_url(key)
        illustrations[slot_id] = {
            "storage_key": key,
            "public_url": public,
            **({"crop": entry["crop"]} if entry.get("crop") is not None else {}),
        }
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
        illustrations=illustrations,
        tweaks=book.tweaks or {},
    )


def _serialize_generation(book: Book, plan: BookPlan | None) -> BookGenerationDetail:
    storage = None
    pdf_url = book.pdf_url
    cover_url = book.cover_image_url
    if book.pdf_r2_key:
        storage = get_r2_storage()
        pdf_url = storage.public_url(book.pdf_r2_key)
    if book.cover_r2_key:
        if storage is None:
            storage = get_r2_storage()
        cover_url = storage.public_url(book.cover_r2_key)
    return BookGenerationDetail(
        book_id=book.id,
        status=book.status,  # type: ignore[arg-type]
        progress=book.progress,
        current_stage=book.current_stage,
        generated_title=plan.generated_title if plan else book.title,
        subtitle=plan.subtitle if plan else None,
        theme_summary=plan.theme_summary if plan else None,
        pdf_url=pdf_url,
        cover_url=cover_url,
        error_message=book.error_message,
    )


async def _generation_detail(book: Book, session) -> BookGenerationDetail:  # type: ignore[no-untyped-def]
    plan = (
        await session.execute(select(BookPlan).where(BookPlan.book_id == book.id))
    ).scalar_one_or_none()
    return _serialize_generation(book, plan)


def _generation_worker_ready() -> tuple[bool, str | None]:
    app = generate_book_pipeline.app
    try:
        connection = app.connection_for_write()
        connection.ensure_connection(max_retries=1)
        connection.release()
    except Exception as exc:
        return False, f"Book queue broker unavailable: {exc}"

    try:
        inspector = app.control.inspect(timeout=GENERATION_WORKER_INSPECT_TIMEOUT_SECONDS)
        pings = inspector.ping()
    except Exception as exc:
        return False, f"Book queue worker unavailable: {exc}"
    if not pings:
        return False, "Book queue worker unavailable"

    try:
        registered = inspector.registered() or {}
    except Exception as exc:
        return False, f"Book queue worker task registry unavailable: {exc}"
    task_name = generate_book_pipeline.name
    worker_has_task = any(
        any(task == task_name or task.startswith(f"{task_name}[") for task in tasks)
        for tasks in registered.values()
    )
    if not worker_has_task:
        return False, "Book generation worker is running old code. Restart the worker."
    return True, None


@router.post(
    "/generate",
    response_model=BookGenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_generated_book(
    payload: BookGenerateRequest,
    user: CurrentUser,
    session: SessionDep,
) -> BookGenerateResponse:
    worker_ready, worker_error = _generation_worker_ready()
    if not worker_ready:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            worker_error or "Book queue worker unavailable",
        )

    period_start = datetime.combine(payload.date_start, time.min, tzinfo=UTC)
    period_end = datetime.combine(payload.date_end + timedelta(days=1), time.min, tzinfo=UTC)
    config = payload.model_dump(mode="json")
    config.update(
        {
            "flow": GENERATION_FLOW,
            "language": user.preferred_language or "en",
        }
    )
    book = Book(
        user_id=user.id,
        timeframe="custom",
        style=payload.style_preset,
        status="queued",
        progress=1,
        current_stage="queued",
        image_mode="abstract" if payload.cover_mode == "ai_mood" else "photo_inspired",
        include_voice_transcripts=payload.include_voice_transcripts,
        period_start=period_start,
        period_end=period_end,
        config=config,
        title=payload.custom_title,
    )
    session.add(book)
    await session.commit()
    await session.refresh(book)

    try:
        generate_book_pipeline.delay(str(book.id))
    except Exception as exc:
        book.status = "failed"
        book.error_message = f"Book queue unavailable: {exc}"
        await session.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Book queue unavailable",
        ) from exc

    return BookGenerateResponse(
        book_id=book.id,
        status=book.status,  # type: ignore[arg-type]
        estimated_minutes=GENERATION_ESTIMATED_MINUTES,
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
        config={"flow": PREVIEW_FLOW},
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


@router.get("/previews/latest", response_model=BookPreviewResponse | None)
async def get_latest_book_preview(
    user: CurrentUser,
    session: SessionDep,
) -> BookPreviewResponse | None:
    """Return the user's most recent book preview, or null if they have none.

    Declared BEFORE /previews/{book_id} so FastAPI matches the literal
    'latest' path instead of trying to parse it as a UUID.
    """
    book = (
        await session.execute(
        select(Book)
            .where(Book.user_id == user.id, _preview_filter())
            .order_by(Book.created_at.desc())
            .limit(1),
        )
    ).scalar_one_or_none()
    if book is None:
        return None
    return _serialize(book)


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


@router.get("", response_model=BookGenerationListResponse)
async def list_generated_books(
    user: CurrentUser,
    session: SessionDep,
    status_filter: Annotated[BookGenerationStatus | None, Query(alias="status")] = None,
) -> BookGenerationListResponse:
    filters = [Book.user_id == user.id, _generation_filter()]
    if status_filter is not None:
        filters.append(Book.status == status_filter)
    books = list(
        (
            await session.execute(
                select(Book).where(*filters).order_by(Book.created_at.desc()).limit(50)
            )
        )
        .scalars()
        .all()
    )
    if not books:
        return BookGenerationListResponse(items=[])

    plan_rows = (
        await session.execute(
            select(BookPlan).where(BookPlan.book_id.in_([book.id for book in books]))
        )
    ).scalars()
    plans = {plan.book_id: plan for plan in plan_rows}
    return BookGenerationListResponse(
        items=[_serialize_generation(book, plans.get(book.id)) for book in books]
    )


@router.get("/{book_id}", response_model=BookGenerationDetail)
async def get_generated_book(
    book_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> BookGenerationDetail:
    book = await _load_generation_book(book_id, user.id, session)
    return await _generation_detail(book, session)


@router.post("/{book_id}/cancel", response_model=BookGenerationDetail)
async def cancel_generated_book(
    book_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> BookGenerationDetail:
    book = await _load_generation_book(book_id, user.id, session)
    if book.status not in {"queued", "processing"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Book cannot be cancelled")
    book.status = "cancelled"
    book.current_stage = "cancelled"
    book.error_message = "Cancelled by user"
    book.progress = min(book.progress, 99)
    await session.commit()
    await session.refresh(book)
    return await _generation_detail(book, session)
