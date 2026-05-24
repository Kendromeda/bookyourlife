from __future__ import annotations

import base64
import json
import re
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import anyio
import httpx
import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape
from langdetect import LangDetectException, detect
from openai import OpenAI
from playwright.async_api import async_playwright
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import session_scope
from app.models.book import (
    Book,
    BookChapter,
    BookChapterEntry,
    BookJob,
    BookPlan,
    EntryEnhancement,
    GeneratedAsset,
)
from app.models.entry import Entry
from app.services.push.fcm import FcmService
from app.services.storage.r2 import get_r2_storage
from app.tasks.async_runner import run_async
from app.tasks.book_gen import _transcribe_missing_audio
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()

STAGES = ["prepare", "transcribe", "plan", "texts", "images", "render", "finalize", "notify"]
STAGE_PROGRESS = {
    "prepare": 5,
    "transcribe": 15,
    "plan": 25,
    "texts": 55,
    "images": 85,
    "render": 95,
    "finalize": 100,
    "notify": 100,
}
MIN_BOOK_ENTRIES = 20
MAX_BOOK_ENTRIES = 200
THEMATIC_MAX_DAYS = 30
MONTHLY_MAX_DAYS = 180
YEAR_MAX_DAYS = 365
MONTHLY_ENTRY_LIMIT = 80
COLLAGE_MIN_PHOTOS = 3
PHOTO_HERO_MAX_WORDS = 250
TEXT_FOCUS_MIN_WORDS = 350
QUOTE_SPOTLIGHT_MAX_WORDS = 80
LANGUAGE_SAMPLE_MIN_WORDS = 5
PULL_QUOTE_MIN_WORDS = 4
PULL_QUOTE_MAX_WORDS = 18
ENTRY_ENHANCEMENT_BATCH_SIZE = 5
MIN_LAYOUT_TEMPLATE = 1
MAX_LAYOUT_TEMPLATE = 5
ILLUSTRATED_REQUIRED_FAILURE_THRESHOLD = 0.5
OPENAI_IMAGE_TIMEOUT_SECONDS = 360
IMAGE_GENERATION_MODES = {"illustrated", "mixed"}
NEGATIVE_PROMPT_UNIVERSAL = (
    "text, watermark, logo, signature, words, letters, captions, deformed hands, "
    "deformed face, extra fingers, blurry, low quality, distorted features, cropped, "
    "frame, border"
)
STYLE_PROMPTS = {
    "watercolor": (
        "soft watercolor on cold-pressed paper, translucent pigment, muted warm tones, "
        "gentle bleeding edges, intimate and hand-painted"
    ),
    "pencil": (
        "graphite pencil sketch, fine cross-hatching, natural paper grain, quiet tonal "
        "shading, handmade editorial drawing"
    ),
    "vintage": (
        "vintage 35mm film photograph mood, faded colors, warm cast, soft focus, subtle "
        "grain, nostalgic editorial composition"
    ),
    "anime": (
        "warm hand-drawn animated film background, painterly textures, soft natural "
        "lighting, expressive but grounded composition"
    ),
}

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates" / "book"
prompt_env = Environment(
    loader=FileSystemLoader(PROMPTS_DIR),
    autoescape=select_autoescape(),
    trim_blocks=True,
    lstrip_blocks=True,
)
book_template_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


@dataclass(frozen=True)
class _AssetRequest:
    asset_type: str
    ref_id: UUID | None
    prompt: str
    alt_text: str
    source_storage_key: str | None = None
    requires_generation: bool = True


@celery_app.task(name="app.tasks.book_pipeline.generate_book_pipeline")
def generate_book_pipeline(book_id: str) -> None:
    run_async(_run_pipeline(UUID(book_id)))


async def _run_pipeline(book_id: UUID) -> None:
    current_stage: str | None = None
    try:
        for stage, handler in [
            ("prepare", _prepare_stage),
            ("transcribe", _transcribe_stage),
            ("plan", _plan_stage),
            ("texts", _texts_stage),
            ("images", _images_stage),
            ("render", _render_stage),
            ("finalize", _finalize_stage),
            ("notify", _notify_stage),
        ]:
            current_stage = stage
            await _run_stage(book_id, stage, handler)
    except _BookCancelled:
        logger.info("book generation cancelled", book_id=str(book_id))
    except _BookGenerationError as exc:
        await _mark_book_failed(book_id, current_stage, str(exc))
    except Exception as exc:
        logger.warning("book generation failed", book_id=str(book_id), error=str(exc))
        await _mark_book_failed(book_id, current_stage, str(exc))


async def _run_stage(book_id: UUID, stage: str, handler) -> None:  # type: ignore[no-untyped-def]
    await _raise_if_cancelled(book_id)
    await _mark_stage_running(book_id, stage)
    try:
        meta = await handler(book_id)
    except _StageSkipped as exc:
        await _mark_stage_finished(book_id, stage, "skipped", STAGE_PROGRESS[stage], meta=exc.meta)
        return
    except Exception as exc:
        await _mark_stage_finished(
            book_id,
            stage,
            "failed",
            None,
            error=str(exc),
        )
        raise
    await _mark_stage_finished(book_id, stage, "done", STAGE_PROGRESS[stage], meta=meta or {})


async def _prepare_stage(book_id: UUID) -> dict:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one_or_none()
        if book is None:
            raise _BookGenerationError("Book not found")
        if (book.config or {}).get("flow") != "generation":
            raise _BookGenerationError("Book is not a generation job")
        if book.period_start is None or book.period_end is None:
            raise _BookGenerationError("Book date range is missing")

        entries = await _load_entries_for_book(book, session)
        entry_count = len(entries)
        if entry_count < MIN_BOOK_ENTRIES:
            raise _BookGenerationError("Choose at least 20 entries to generate a book.")
        if entry_count > MAX_BOOK_ENTRIES:
            raise _BookGenerationError("Choose 200 entries or fewer to generate a book.")

        existing_jobs = set(
            (
                await session.execute(select(BookJob.stage).where(BookJob.book_id == book_id))
            ).scalars()
        )
        for stage in STAGES:
            if stage not in existing_jobs:
                session.add(BookJob(book_id=book_id, stage=stage, status="pending"))

        book.status = "processing"
        book.started_at = book.started_at or _now()
        book.error_message = None
        book.current_stage = "prepare"
        return {"entry_count": entry_count}


async def _transcribe_stage(book_id: UUID) -> dict:
    settings = get_settings()
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        include_voice = bool((book.config or {}).get("include_voice_transcripts"))
        entries = await _load_entries_for_book(book, session)
    if not include_voice:
        raise _StageSkipped({"reason": "voice transcripts disabled"})
    if not settings.openai_api_key:
        raise _StageSkipped({"reason": "OpenAI not configured"})

    await _transcribe_missing_audio(entries)
    return {"audio_entries": sum(1 for entry in entries if entry.audios)}


async def _plan_stage(book_id: UUID) -> dict:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        entries = await _load_entries_for_book(book, session)

    language = _detect_language(entries, (book.config or {}).get("language", "en"))
    strategy = _chapter_strategy(book, len(entries))
    plan = await _llm_or_fallback_plan(book, entries, strategy, language)

    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        await _replace_plan(session, book, entries, plan, strategy, language)
    return {"strategy": strategy, "chapter_count": len(plan["chapters"]), "language": language}


async def _texts_stage(book_id: UUID) -> dict:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        entries = await _load_entries_for_book(book, session)
        plan = (
            await session.execute(select(BookPlan).where(BookPlan.book_id == book_id))
        ).scalar_one()
        chapters = list(
            (
                await session.execute(
                    select(BookChapter)
                    .where(BookChapter.book_id == book_id)
                    .order_by(BookChapter.position)
                )
            )
            .scalars()
            .all()
        )

    generated_texts = await _llm_or_fallback_texts(book, plan, entries, chapters)
    enhancements = await _llm_or_fallback_enhancements(book, entries)

    async with session_scope() as session:
        plan = (
            await session.execute(select(BookPlan).where(BookPlan.book_id == book_id))
        ).scalar_one()
        chapters = list(
            (
                await session.execute(
                    select(BookChapter)
                    .where(BookChapter.book_id == book_id)
                    .order_by(BookChapter.position)
                )
            )
            .scalars()
            .all()
        )
        plan_payload = dict(plan.plan or {})
        plan_payload["preface"] = generated_texts["preface"]
        plan_payload["epilog"] = generated_texts["epilog"]
        plan.plan = plan_payload

        intros = generated_texts["chapter_intros"]
        for chapter in chapters:
            chapter.intro_text = intros.get(str(chapter.position), chapter.theme or "")

        await session.execute(delete(EntryEnhancement).where(EntryEnhancement.book_id == book_id))
        for entry in entries:
            enhancement = enhancements[entry.id]
            session.add(
                EntryEnhancement(
                    book_id=book_id,
                    entry_id=entry.id,
                    layout_template=enhancement["layout_template"],
                    pull_quote=enhancement["pull_quote"],
                    pull_quote_position=enhancement["pull_quote_position"],
                    photo_captions=enhancement["photo_captions"],
                    transcript=enhancement["transcript"],
                )
            )
    return {"entry_enhancements": len(entries)}


async def _images_stage(book_id: UUID) -> dict:
    settings = get_settings()
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        entries = await _load_entries_for_book(book, session)
        plan = (
            await session.execute(select(BookPlan).where(BookPlan.book_id == book_id))
        ).scalar_one_or_none()
        chapters = list(
            (
                await session.execute(
                    select(BookChapter)
                    .where(BookChapter.book_id == book_id)
                    .order_by(BookChapter.position)
                )
            )
            .scalars()
            .all()
        )

    requests = _image_asset_requests(book, plan, chapters, entries)
    generated_assets = [
        _build_generated_asset(book, request, settings) for request in requests
    ]

    _raise_if_required_illustrations_failed(book, generated_assets)

    async with session_scope() as session:
        await session.execute(delete(GeneratedAsset).where(GeneratedAsset.book_id == book_id))
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        chapters_by_id = {
            chapter.id: chapter
            for chapter in (
                await session.execute(select(BookChapter).where(BookChapter.book_id == book_id))
            )
            .scalars()
            .all()
        }

        cover_asset: GeneratedAsset | None = None
        for asset in generated_assets:
            session.add(asset)
            await session.flush()
            if asset.asset_type == "cover":
                cover_asset = asset
            if asset.asset_type == "chapter_opener" and asset.ref_id in chapters_by_id:
                chapters_by_id[asset.ref_id].cover_asset_id = asset.id

        if cover_asset is not None and cover_asset.r2_key:
            is_bucket = _is_bucket_storage_key(cover_asset.r2_key)
            # Bucket covers are served by re-signing cover_r2_key at response
            # time (see books._serialize_generation); never persist a signed
            # URL that would expire. Local-dev file URIs are safe to store.
            book.cover_r2_key = cover_asset.r2_key if is_bucket else None
            book.cover_image_url = None if is_bucket else cover_asset.r2_key

    return {
        "cover": sum(1 for asset in generated_assets if asset.asset_type == "cover"),
        "chapter_openers": sum(
            1 for asset in generated_assets if asset.asset_type == "chapter_opener"
        ),
        "entry_images": sum(1 for asset in generated_assets if asset.asset_type == "entry_image"),
        "generated": sum(1 for asset in generated_assets if asset.status == "done"),
        "fallback": sum(1 for asset in generated_assets if asset.status == "failed_fallback"),
    }


async def _render_stage(book_id: UUID) -> dict:
    html = await _build_book_html(book_id)
    pdf_bytes = await _render_html_to_pdf(html)
    pdf_path = Path(tempfile.gettempdir()) / f"lifebook-{book_id}.pdf"
    await anyio.Path(pdf_path).write_bytes(pdf_bytes)
    return {"pdf_path": str(pdf_path), "bytes": len(pdf_bytes)}


async def _finalize_stage(book_id: UUID) -> dict:
    async with session_scope() as session:
        render_job = (
            await session.execute(
                select(BookJob).where(BookJob.book_id == book_id, BookJob.stage == "render")
            )
        ).scalar_one()
        pdf_path_value = (render_job.meta or {}).get("pdf_path")
        if not pdf_path_value:
            raise _BookGenerationError("Rendered PDF path is missing")
        pdf_path = Path(str(pdf_path_value))
        async_pdf_path = anyio.Path(pdf_path)
        if not await async_pdf_path.exists():
            raise _BookGenerationError("Rendered PDF file is missing")

        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        if book.status == "cancelled":
            raise _BookCancelled()
        settings = get_settings()
        pdf_key: str | None = None
        if _r2_configured(settings):
            storage = get_r2_storage()
            pdf_key = storage.upload_bytes(
                key_prefix=f"book-pdf/{book.user_id}/{book.id}",
                data=await async_pdf_path.read_bytes(),
                content_type="application/pdf",
            )
            # Served via re-signing pdf_r2_key at response time; don't persist
            # a signed URL that would expire.
            pdf_url = None
        else:
            pdf_url = pdf_path.as_uri()

        await session.refresh(book)
        if book.status == "cancelled":
            raise _BookCancelled()
        book.pdf_r2_key = pdf_key
        book.pdf_url = pdf_url
        book.status = "completed"
        book.progress = 100
        book.current_stage = "completed"
        book.completed_at = _now()
        book.generated_at = book.completed_at
        return {"pdf_url": book.pdf_url}


async def _notify_stage(book_id: UUID) -> dict:
    try:
        async with session_scope() as session:
            book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
            tokens = await FcmService.tokens_for_user(session, book.user_id)
        sent = FcmService.send(
            tokens=tokens,
            title="Your book is ready",
            body="Your generated Life Book PDF is ready to read.",
            deep_link=f"journal://books/{book_id}",
        )
        return {"sent": sent}
    except Exception as exc:
        logger.warning("book notification skipped", book_id=str(book_id), error=str(exc))
        return {"sent": 0, "error": str(exc)}


async def _load_entries_for_book(book: Book, session) -> list[Entry]:  # type: ignore[no-untyped-def]
    if book.period_start is None or book.period_end is None:
        return []
    return list(
        (
            await session.execute(
                select(Entry)
                .where(
                    Entry.user_id == book.user_id,
                    Entry.written_at >= book.period_start,
                    Entry.written_at < book.period_end,
                )
                .options(selectinload(Entry.photos), selectinload(Entry.audios))
                .order_by(Entry.written_at)
            )
        )
        .scalars()
        .all()
    )


async def _replace_plan(
    session,  # type: ignore[no-untyped-def]
    book: Book,
    entries: list[Entry],
    plan: dict,
    strategy: str,
    language: str,
) -> None:
    chapter_ids = select(BookChapter.id).where(BookChapter.book_id == book.id)
    await session.execute(
        delete(BookChapterEntry).where(BookChapterEntry.chapter_id.in_(chapter_ids))
    )
    await session.execute(delete(BookChapter).where(BookChapter.book_id == book.id))
    await session.execute(delete(BookPlan).where(BookPlan.book_id == book.id))

    generated_title = (book.config or {}).get("custom_title") or plan["book_title"]
    book.title = generated_title
    config = dict(book.config or {})
    config["language"] = language
    book.config = config

    session.add(
        BookPlan(
            book_id=book.id,
            generated_title=generated_title,
            subtitle=plan.get("subtitle"),
            theme_summary=plan["theme_summary"],
            dominant_mood=plan.get("dominant_mood"),
            chapter_strategy=strategy,
            plan=plan,
        )
    )
    entry_ids = {str(entry.id): entry.id for entry in entries}
    for chapter_data in plan["chapters"]:
        chapter = BookChapter(
            book_id=book.id,
            part_label=chapter_data.get("part_label"),
            position=int(chapter_data["position"]),
            title=chapter_data["title"],
            theme=chapter_data.get("theme"),
            date_range_start=_date_or_none(chapter_data.get("date_range_start")),
            date_range_end=_date_or_none(chapter_data.get("date_range_end")),
            intro_text=chapter_data.get("chapter_intro_hint"),
        )
        session.add(chapter)
        await session.flush()
        for position, entry_id_str in enumerate(chapter_data.get("entry_ids", []), start=1):
            entry_id = entry_ids.get(str(entry_id_str))
            if entry_id is None:
                continue
            session.add(
                BookChapterEntry(chapter_id=chapter.id, entry_id=entry_id, position=position)
            )


async def _llm_or_fallback_plan(
    book: Book,
    entries: list[Entry],
    strategy: str,
    language: str,
) -> dict:
    settings = get_settings()
    if settings.book_generation_ai_enabled and settings.openai_api_key:
        try:
            return _normalize_plan_payload(
                _generate_plan_with_llm(book, entries, strategy, language),
                entries,
                strategy,
            )
        except Exception as exc:
            logger.warning("book plan llm fallback", book_id=str(book.id), error=str(exc))
    return _fallback_plan(book, entries, strategy, language)


def _generate_plan_with_llm(
    book: Book,
    entries: list[Entry],
    strategy: str,
    language: str,
) -> dict:
    settings = get_settings()
    template = prompt_env.get_template("book_chapter_plan.j2")
    prompt = template.render(
        language=language,
        start_date=book.period_start.date().isoformat() if book.period_start else "",
        end_date=(_display_end_date(book).isoformat() if book.period_end else ""),
        period_days=_period_days(book),
        entry_count=len(entries),
        chapter_strategy=strategy,
        entries_json=json.dumps(_entry_summaries(entries), ensure_ascii=False),
    )
    client = _generation_openai_client(settings)
    response = client.chat.completions.create(
        model=settings.openai_model_narrative,
        messages=[
            {"role": "system", "content": "You are a careful memoir book editor."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=3_000,
        timeout=settings.book_generation_openai_timeout_seconds,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise _BookGenerationError("OpenAI returned an empty chapter plan")
    return json.loads(content)


async def _llm_or_fallback_texts(
    book: Book,
    plan: BookPlan,
    entries: list[Entry],
    chapters: list[BookChapter],
) -> dict:
    settings = get_settings()
    if settings.book_generation_ai_enabled and settings.openai_api_key:
        try:
            return _generate_texts_with_llm(book, plan, entries, chapters)
        except Exception as exc:
            logger.warning("book texts llm fallback", book_id=str(book.id), error=str(exc))
    return _fallback_texts(book, plan, chapters)


def _generate_texts_with_llm(
    book: Book,
    plan: BookPlan,
    entries: list[Entry],
    chapters: list[BookChapter],
) -> dict:
    settings = get_settings()
    template = prompt_env.get_template("book_generation_texts.j2")
    prompt = template.render(
        language=(book.config or {}).get("language", "en"),
        title=plan.generated_title,
        theme_summary=plan.theme_summary,
        chapters=[
            {"position": chapter.position, "title": chapter.title, "theme": chapter.theme}
            for chapter in chapters
        ],
        entries_json=json.dumps(_entry_summaries(entries), ensure_ascii=False),
    )
    client = _generation_openai_client(settings)
    response = client.chat.completions.create(
        model=settings.openai_model_narrative,
        messages=[
            {"role": "system", "content": "Write short connective text for a personal book."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=1_500,
        timeout=settings.book_generation_openai_timeout_seconds,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise _BookGenerationError("OpenAI returned empty book text")
    payload = json.loads(content)
    return {
        "preface": str(payload.get("preface") or ""),
        "epilog": str(payload.get("epilog") or ""),
        "chapter_intros": {
            str(item.get("position")): str(item.get("intro") or "")
            for item in payload.get("chapter_intros", [])
            if isinstance(item, dict)
        },
    }


async def _llm_or_fallback_enhancements(
    book: Book,
    entries: list[Entry],
) -> dict[UUID, dict]:
    fallback = {entry.id: _fallback_enhancement(book, entry) for entry in entries}
    settings = get_settings()
    if not settings.book_generation_ai_enabled or not settings.openai_api_key:
        return fallback

    enhancements = dict(fallback)
    for batch in _chunks(entries, ENTRY_ENHANCEMENT_BATCH_SIZE):
        try:
            payload = _generate_entry_enhancements_with_llm(book, batch)
            enhancements.update(_normalize_entry_enhancements(payload, batch, fallback))
        except Exception as exc:
            logger.warning(
                "book entry enhancement llm fallback",
                book_id=str(book.id),
                count=len(batch),
                error=str(exc),
            )
    return enhancements


def _generate_entry_enhancements_with_llm(book: Book, entries: list[Entry]) -> dict:
    settings = get_settings()
    template = prompt_env.get_template("book_entry_enhancements.j2")
    prompt = template.render(
        language=(book.config or {}).get("language", "en"),
        entries_json=json.dumps(_entry_enhancement_summaries(entries), ensure_ascii=False),
    )
    client = _generation_openai_client(settings)
    response = client.chat.completions.create(
        model=settings.openai_model_narrative,
        messages=[
            {
                "role": "system",
                "content": "Produce strict JSON metadata for printable journal book layouts.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=1_800,
        timeout=settings.book_generation_openai_timeout_seconds,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise _BookGenerationError("OpenAI returned empty entry enhancements")
    return json.loads(content)


def _normalize_entry_enhancements(
    payload: dict,
    entries: list[Entry],
    fallback: dict[UUID, dict],
) -> dict[UUID, dict]:
    raw_items = payload.get("entries")
    if not isinstance(raw_items, list):
        raw_items = []

    entry_by_id = {str(entry.id): entry for entry in entries}
    normalized: dict[UUID, dict] = {}
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        entry = entry_by_id.get(str(item.get("entry_id")))
        if entry is None:
            continue

        base = dict(fallback[entry.id])
        layout_template = _coerce_layout_template(item.get("layout_template"))
        if layout_template is not None:
            base["layout_template"] = layout_template

        quote = item.get("pull_quote")
        if isinstance(quote, str) and _quote_is_verbatim(quote, entry.body):
            base["pull_quote"] = quote.strip().strip('"“”')
            position = item.get("pull_quote_position")
            base["pull_quote_position"] = (
                position if position in {"top", "middle", "bottom"} else "top"
            )
        elif quote is None:
            base["pull_quote"] = None
            base["pull_quote_position"] = None

        captions = _normalize_photo_captions(item.get("photo_captions"), entry, base)
        base["photo_captions"] = captions
        normalized[entry.id] = base
    return normalized


def _entry_enhancement_summaries(entries: list[Entry]) -> list[dict]:
    return [
        {
            "entry_id": str(entry.id),
            "date": entry.written_at.date().isoformat(),
            "title": entry.title,
            "body": entry.body[:1_200],
            "word_count": _word_count(entry.body),
            "photo_count": len(entry.photos),
            "photo_ids": [str(photo.id) for photo in entry.photos],
            "emotion_tags": entry.emotion_tags,
        }
        for entry in entries
    ]


def _normalize_photo_captions(raw: object, entry: Entry, base: dict) -> list[dict]:
    fallback_by_id = {
        str(item.get("photo_id")): str(item.get("caption") or "")
        for item in base.get("photo_captions") or []
        if isinstance(item, dict)
    }
    raw_by_id = {}
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            photo_id = str(item.get("photo_id") or "")
            caption = str(item.get("caption") or "").strip()
            if photo_id and caption:
                raw_by_id[photo_id] = caption[:160]
    captions = []
    for photo in entry.photos:
        photo_id = str(photo.id)
        captions.append(
            {
                "photo_id": photo_id,
                "caption": raw_by_id.get(photo_id)
                or fallback_by_id.get(photo_id)
                or entry.title
                or "A remembered moment",
            }
        )
    return captions


def _coerce_layout_template(value: object) -> int | None:
    try:
        layout_template = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if MIN_LAYOUT_TEMPLATE <= layout_template <= MAX_LAYOUT_TEMPLATE:
        return layout_template
    return None


def _quote_is_verbatim(quote: str, body: str) -> bool:
    cleaned = quote.strip().strip('"“”')
    words = cleaned.split()
    return PULL_QUOTE_MIN_WORDS <= len(words) <= PULL_QUOTE_MAX_WORDS and cleaned in body


def _generation_openai_client(settings) -> OpenAI:  # type: ignore[no-untyped-def]
    return OpenAI(
        api_key=settings.openai_api_key,
        max_retries=settings.book_generation_openai_max_retries,
    )


def _fallback_texts(book: Book, plan: BookPlan, chapters: list[BookChapter]) -> dict:
    title = plan.generated_title or book.title or "Your Life Book"
    return {
        "preface": (
            f"This book gathers the ordinary and meaningful days behind {title}. "
            "The entries remain in the writer's own words, with only light editorial framing."
        ),
        "epilog": (
            "The last page is not an ending. It is a marker of what was noticed, "
            "kept, and carried forward."
        ),
        "chapter_intros": {
            str(chapter.position): chapter.theme or f"A chapter from {title}."
            for chapter in chapters
        },
    }


def _fallback_plan(book: Book, entries: list[Entry], strategy: str, language: str) -> dict:
    grouped = _group_entries(entries, strategy)
    title = (book.config or {}).get("custom_title") or _fallback_title(book, language)
    chapters = []
    for index, (label, chapter_entries) in enumerate(grouped, start=1):
        start = chapter_entries[0].written_at.date()
        end = chapter_entries[-1].written_at.date()
        chapters.append(
            {
                "position": index,
                "part_label": _part_label(label, strategy),
                "title": _chapter_title(label, index),
                "theme": f"Entries from {start.isoformat()} to {end.isoformat()}.",
                "entry_ids": [str(entry.id) for entry in chapter_entries],
                "date_range_start": start.isoformat(),
                "date_range_end": end.isoformat(),
                "chapter_intro_hint": "A set of remembered days, kept in sequence.",
            }
        )
    return {
        "book_title": title,
        "subtitle": _fallback_subtitle(book),
        "theme_summary": "A personal collection of journal entries gathered into a printable book.",
        "dominant_mood": "reflective",
        "chapters": chapters,
        "skipped_entry_ids": [],
    }


def _normalize_plan_payload(payload: dict, entries: list[Entry], strategy: str) -> dict:
    entry_ids = {str(entry.id) for entry in entries}
    seen: set[str] = set()
    chapters = []
    for index, item in enumerate(payload.get("chapters", []), start=1):
        if not isinstance(item, dict):
            continue
        raw_ids = [str(value) for value in item.get("entry_ids", [])]
        chapter_ids = [
            entry_id for entry_id in raw_ids if entry_id in entry_ids and entry_id not in seen
        ]
        seen.update(chapter_ids)
        if not chapter_ids:
            continue
        chapters.append(
            {
                "position": int(item.get("position") or index),
                "part_label": item.get("part_label"),
                "title": str(item.get("title") or f"Chapter {index}"),
                "theme": str(item.get("theme") or ""),
                "entry_ids": chapter_ids,
                "date_range_start": item.get("date_range_start"),
                "date_range_end": item.get("date_range_end"),
                "chapter_intro_hint": str(item.get("chapter_intro_hint") or ""),
            }
        )
    missing = [entry_id for entry_id in entry_ids if entry_id not in seen]
    if missing:
        entry_map = {str(entry.id): entry for entry in entries}
        fallback = _fallback_plan_for_entries(
            [entry_map[entry_id] for entry_id in missing], strategy
        )
        offset = len(chapters)
        for item in fallback:
            item["position"] += offset
            chapters.append(item)
    if not chapters:
        raise _BookGenerationError("Chapter plan did not include usable chapters")
    for position, chapter in enumerate(chapters, start=1):
        chapter["position"] = position
    return {
        "book_title": str(payload.get("book_title") or "Your Life Book"),
        "subtitle": str(payload.get("subtitle") or ""),
        "theme_summary": str(payload.get("theme_summary") or "A personal journal collection."),
        "dominant_mood": str(payload.get("dominant_mood") or "reflective"),
        "chapters": chapters,
        "skipped_entry_ids": payload.get("skipped_entry_ids", []),
    }


def _fallback_plan_for_entries(entries: list[Entry], strategy: str) -> list[dict]:
    chapters = []
    for index, (label, grouped_entries) in enumerate(_group_entries(entries, strategy), start=1):
        chapters.append(
            {
                "position": index,
                "part_label": _part_label(label, strategy),
                "title": _chapter_title(label, index),
                "theme": "Additional entries kept in chronological order.",
                "entry_ids": [str(entry.id) for entry in grouped_entries],
                "date_range_start": grouped_entries[0].written_at.date().isoformat(),
                "date_range_end": grouped_entries[-1].written_at.date().isoformat(),
                "chapter_intro_hint": "A continuation of the same season.",
            }
        )
    return chapters


def _group_entries(entries: list[Entry], strategy: str) -> list[tuple[str, list[Entry]]]:
    if strategy in {"monthly", "monthly_with_quarterly_parts", "part_chapter"}:
        grouped: dict[str, list[Entry]] = defaultdict(list)
        for entry in entries:
            grouped[entry.written_at.strftime("%Y-%m")].append(entry)
        return sorted(grouped.items(), key=lambda item: item[0])

    target_chapters = 4 if strategy == "seasonal" else min(6, max(3, len(entries) // 12))
    chunk_size = max(1, (len(entries) + target_chapters - 1) // target_chapters)
    return [
        (f"chapter-{index + 1}", entries[index : index + chunk_size])
        for index in range(0, len(entries), chunk_size)
    ]


def _fallback_enhancement(book: Book, entry: Entry) -> dict:
    word_count = _word_count(entry.body)
    photo_count = len(entry.photos)
    if photo_count >= COLLAGE_MIN_PHOTOS:
        layout_template = 3
    elif photo_count >= 1 and word_count <= PHOTO_HERO_MAX_WORDS:
        layout_template = 1
    elif word_count > TEXT_FOCUS_MIN_WORDS and photo_count <= 1:
        layout_template = 2
    elif word_count <= QUOTE_SPOTLIGHT_MAX_WORDS:
        layout_template = 4
    else:
        layout_template = 5

    captions = [
        {"photo_id": str(photo.id), "caption": entry.title or "A remembered moment"}
        for photo in entry.photos
    ]
    transcript = None
    if (book.config or {}).get("include_voice_transcripts"):
        transcripts = [audio.transcript for audio in entry.audios if audio.transcript]
        transcript = "\n\n".join(transcripts) if transcripts else None
    quote = _pull_quote(entry.body)
    return {
        "layout_template": layout_template,
        "pull_quote": quote,
        "pull_quote_position": "top" if quote else None,
        "photo_captions": captions,
        "transcript": transcript,
    }


def _image_asset_requests(
    book: Book,
    plan: BookPlan | None,
    chapters: list[BookChapter],
    entries: list[Entry],
) -> list[_AssetRequest]:
    config = book.config or {}
    mode = str(config.get("mode") or "illustrated")
    cover_mode = str(config.get("cover_mode") or "ai_mood")
    style = str(config.get("style_preset") or book.style or "watercolor")
    title = book.title or (plan.generated_title if plan else None) or "Untitled Book"
    best_photo_key = _best_photo_storage_key(entries)

    requests: list[_AssetRequest] = []
    if cover_mode == "best_photo" or mode == "photo_only":
        if best_photo_key:
            requests.append(
                _AssetRequest(
                    asset_type="cover",
                    ref_id=book.id,
                    prompt=f"Best user photo cover for {title}",
                    alt_text=f"Cover image for {title}",
                    source_storage_key=best_photo_key,
                    requires_generation=False,
                )
            )
        elif mode == "photo_only":
            requests.append(
                _AssetRequest(
                    asset_type="cover",
                    ref_id=book.id,
                    prompt=f"Photo-only cover placeholder for {title}",
                    alt_text=f"Cover image for {title}",
                    requires_generation=False,
                )
            )

    if not any(request.asset_type == "cover" for request in requests):
        requests.append(
            _AssetRequest(
                asset_type="cover",
                ref_id=book.id,
                prompt=_cover_image_prompt(book, plan, style, title),
                alt_text=f"Illustrated cover for {title}",
            )
        )

    if mode not in IMAGE_GENERATION_MODES:
        return requests

    for chapter in chapters:
        requests.append(
            _AssetRequest(
                asset_type="chapter_opener",
                ref_id=chapter.id,
                prompt=_chapter_opener_prompt(chapter, plan, style),
                alt_text=f"Illustration for {chapter.title}",
            )
        )
    for entry in entries:
        if entry.photos:
            continue
        requests.append(
            _AssetRequest(
                asset_type="entry_image",
                ref_id=entry.id,
                prompt=_entry_image_prompt(entry, style),
                alt_text=f"Margin illustration for {entry.written_at.date().isoformat()}",
            )
        )
    return requests


def _build_generated_asset(
    book: Book,
    request: _AssetRequest,
    settings,  # type: ignore[no-untyped-def]
) -> GeneratedAsset:
    ai_enabled = bool(settings.book_generation_ai_enabled and settings.openai_api_key)
    if request.source_storage_key and not request.requires_generation:
        return GeneratedAsset(
            book_id=book.id,
            asset_type=request.asset_type,
            ref_id=request.ref_id,
            prompt=request.prompt,
            provider="user_photo",
            model="original-photo",
            r2_key=request.source_storage_key,
            status="done",
            attempts=0,
            fallback_strategy="best_photo_cover",
        )

    if not request.requires_generation or not ai_enabled:
        reason = "ai_disabled" if not ai_enabled else "paper_texture_placeholder"
        return _fallback_asset(book, request, reason)

    try:
        image_bytes = _generate_openai_image_bytes(request.prompt, settings)
        storage_key = _store_generated_image(book, request, image_bytes, settings)
        return GeneratedAsset(
            book_id=book.id,
            asset_type=request.asset_type,
            ref_id=request.ref_id,
            prompt=request.prompt,
            provider="openai",
            model=settings.openai_model_image,
            r2_key=storage_key,
            status="done",
            attempts=1,
            fallback_strategy=None,
        )
    except Exception as exc:
        logger.warning(
            "book image generation fallback",
            book_id=str(book.id),
            asset_type=request.asset_type,
            ref_id=str(request.ref_id) if request.ref_id else None,
            error=str(exc),
        )
        fallback = _fallback_asset(book, request, "paper_texture_placeholder")
        fallback.error = str(exc)[:1000]
        fallback.attempts = 1
        return fallback


def _fallback_asset(book: Book, request: _AssetRequest, strategy: str) -> GeneratedAsset:
    return GeneratedAsset(
        book_id=book.id,
        asset_type=request.asset_type,
        ref_id=request.ref_id,
        prompt=request.prompt,
        provider="fallback",
        model="paper-texture",
        status="failed_fallback",
        attempts=0,
        fallback_strategy=strategy,
    )


def _raise_if_required_illustrations_failed(
    book: Book,
    assets: list[GeneratedAsset],
) -> None:
    config = book.config or {}
    mode = str(config.get("mode") or "illustrated")
    if not config.get("illustrated_required") or mode not in IMAGE_GENERATION_MODES:
        return

    chapter_assets = [asset for asset in assets if asset.asset_type == "chapter_opener"]
    failed_chapters = [asset for asset in chapter_assets if not _asset_is_usable(asset)]
    failure_ratio = len(failed_chapters) / len(chapter_assets) if chapter_assets else 0
    if chapter_assets and failure_ratio > ILLUSTRATED_REQUIRED_FAILURE_THRESHOLD:
        raise _BookGenerationError(
            "Illustrations are required, but most chapter illustrations could not be generated."
        )

    cover_assets = [asset for asset in assets if asset.asset_type == "cover"]
    generated_cover_required = str(config.get("cover_mode") or "ai_mood") == "ai_mood"
    if generated_cover_required and cover_assets and not _asset_is_usable(cover_assets[0]):
        raise _BookGenerationError(
            "Illustrations are required, but the cover illustration could not be generated."
        )


def _asset_is_usable(asset: GeneratedAsset) -> bool:
    return asset.status == "done" and bool(asset.r2_key)


def _generate_openai_image_bytes(prompt: str, settings) -> bytes:  # type: ignore[no-untyped-def]
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.images.generate(
        model=settings.openai_model_image,
        prompt=prompt,
        n=1,
        size=settings.openai_image_size,
        timeout=OPENAI_IMAGE_TIMEOUT_SECONDS,
    )
    if not response.data:
        raise _BookGenerationError("OpenAI returned no image data")
    return _image_data_to_bytes(response.data[0])


def _image_data_to_bytes(image: object) -> bytes:
    b64_json = getattr(image, "b64_json", None)
    if b64_json:
        return base64.b64decode(b64_json)

    url = getattr(image, "url", None)
    if url:
        response = httpx.get(url, timeout=60)
        response.raise_for_status()
        return response.content

    raise _BookGenerationError("OpenAI returned no image bytes or image URL")


def _store_generated_image(
    book: Book,
    request: _AssetRequest,
    image_bytes: bytes,
    settings,  # type: ignore[no-untyped-def]
) -> str:
    if _r2_configured(settings):
        storage = get_r2_storage()
        return storage.upload_bytes(
            key_prefix=f"book-assets/{book.user_id}/{book.id}/{request.asset_type}",
            data=image_bytes,
            content_type="image/png",
        )

    asset_dir = Path(tempfile.gettempdir()) / "lifebook-assets" / str(book.id)
    asset_dir.mkdir(parents=True, exist_ok=True)
    ref = request.ref_id or book.id
    asset_path = asset_dir / f"{request.asset_type}-{ref}-{uuid4().hex}.png"
    asset_path.write_bytes(image_bytes)
    return asset_path.as_uri()


def _cover_image_prompt(
    book: Book,
    plan: BookPlan | None,
    style: str,
    title: str,
) -> str:
    theme = plan.theme_summary if plan else "A personal season of journal memories."
    mood = plan.dominant_mood if plan else "reflective"
    return (
        "Create a premium portrait-format memoir cover illustration. "
        f"Title context: {title}. Emotional theme: {theme}. Mood: {mood}. "
        f"Visual style: {_style_prompt(style)}. No readable text, no letters, no logo, "
        f"no watermark. Negative prompt: {NEGATIVE_PROMPT_UNIVERSAL}."
    )


def _chapter_opener_prompt(chapter: BookChapter, plan: BookPlan | None, style: str) -> str:
    book_mood = plan.dominant_mood if plan else "reflective"
    return (
        "Create an evocative chapter opener illustration for a personal journal book. "
        f"Chapter title: {chapter.title}. Chapter theme: {chapter.theme or 'remembered days'}. "
        f"Book mood: {book_mood}. Visual style: {_style_prompt(style)}. "
        "Use a symbolic place, object, light, or atmosphere rather than a portrait. "
        f"No readable text, no logo, no watermark. Negative prompt: {NEGATIVE_PROMPT_UNIVERSAL}."
    )


def _entry_image_prompt(entry: Entry, style: str) -> str:
    summary = re.sub(r"\s+", " ", entry.body).strip()[:600]
    return (
        "Create a small margin illustration for one journal entry. "
        f"Entry date: {entry.written_at.date().isoformat()}. Entry context: {summary}. "
        f"Visual style: {_style_prompt(style)}. Show one object, place, or atmosphere from the "
        "entry. Do not depict the writer or named people. Do not include readable text, logos, "
        f"or watermarks. Negative prompt: {NEGATIVE_PROMPT_UNIVERSAL}."
    )


def _style_prompt(style: str) -> str:
    return STYLE_PROMPTS.get(style, STYLE_PROMPTS["watercolor"])


def _best_photo_storage_key(entries: list[Entry]) -> str | None:
    candidates = [
        (entry.written_at, photo.position, photo.storage_key)
        for entry in entries
        for photo in entry.photos
        if photo.storage_key
    ]
    if not candidates:
        return None
    midpoint = candidates[len(candidates) // 2][0]
    return max(
        candidates,
        key=lambda item: (
            -abs((item[0] - midpoint).total_seconds()),
            -item[1],
        ),
    )[2]


async def _build_book_html(book_id: UUID) -> str:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        plan = (
            await session.execute(select(BookPlan).where(BookPlan.book_id == book_id))
        ).scalar_one()
        chapters = list(
            (
                await session.execute(
                    select(BookChapter)
                    .where(BookChapter.book_id == book_id)
                    .order_by(BookChapter.position)
                )
            )
            .scalars()
            .all()
        )
        chapter_ids = [chapter.id for chapter in chapters]
        links = list(
            (
                await session.execute(
                    select(BookChapterEntry)
                    .where(BookChapterEntry.chapter_id.in_(chapter_ids))
                    .order_by(BookChapterEntry.chapter_id, BookChapterEntry.position)
                )
            )
            .scalars()
            .all()
        )
        entry_ids = [link.entry_id for link in links]
        entries = list(
            (
                await session.execute(
                    select(Entry)
                    .where(Entry.id.in_(entry_ids))
                    .options(selectinload(Entry.photos), selectinload(Entry.audios))
                )
            )
            .scalars()
            .all()
        )
        enhancements = list(
            (
                await session.execute(
                    select(EntryEnhancement).where(EntryEnhancement.book_id == book_id)
                )
            )
            .scalars()
            .all()
        )
        generated_assets = list(
            (
                await session.execute(
                    select(GeneratedAsset).where(GeneratedAsset.book_id == book_id)
                )
            )
            .scalars()
            .all()
        )

    entry_by_id = {entry.id: _entry_render_data(entry) for entry in entries}
    enhancement_by_entry = {item.entry_id: item for item in enhancements}
    assets = _asset_render_context(generated_assets)
    links_by_chapter: dict[UUID, list[BookChapterEntry]] = defaultdict(list)
    for link in links:
        links_by_chapter[link.chapter_id].append(link)

    template = book_template_env.get_template("book.html")
    return template.render(
        book=book,
        plan=plan,
        plan_payload=plan.plan or {},
        chapters=chapters,
        links_by_chapter=links_by_chapter,
        entry_by_id=entry_by_id,
        enhancement_by_entry=enhancement_by_entry,
        cover_asset=assets["cover"],
        chapter_asset_by_chapter=assets["chapter_openers"],
        entry_asset_by_entry=assets["entry_images"],
        dedication=(book.config or {}).get("dedication"),
        generated_at=_now().date().isoformat(),
    )


async def _render_html_to_pdf(html: str) -> bytes:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="networkidle")
        pdf_bytes = await page.pdf(
            format="A5",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            prefer_css_page_size=True,
        )
        await browser.close()
        return pdf_bytes


def _asset_render_context(assets: list[GeneratedAsset]) -> dict:
    cover_asset = next(
        (
            _asset_render_data(asset)
            for asset in assets
            if asset.asset_type == "cover" and _asset_render_data(asset)["url"]
        ),
        None,
    )
    chapter_openers = {
        asset.ref_id: render_data
        for asset in assets
        if asset.asset_type == "chapter_opener" and asset.ref_id
        if (render_data := _asset_render_data(asset))["url"]
    }
    entry_images = {
        asset.ref_id: render_data
        for asset in assets
        if asset.asset_type == "entry_image" and asset.ref_id
        if (render_data := _asset_render_data(asset))["url"]
    }
    return {
        "cover": cover_asset,
        "chapter_openers": chapter_openers,
        "entry_images": entry_images,
    }


def _asset_render_data(asset: GeneratedAsset) -> dict:
    url = _storage_public_url(asset.r2_key or "") if asset.r2_key else ""
    return {
        "id": asset.id,
        "asset_type": asset.asset_type,
        "ref_id": asset.ref_id,
        "url": url,
        "provider": asset.provider,
        "model": asset.model,
        "status": asset.status,
        "fallback_strategy": asset.fallback_strategy,
    }


def _entry_render_data(entry: Entry) -> dict:
    photos = []
    for photo in entry.photos:
        url = _storage_public_url(photo.storage_key)
        if not url:
            continue
        photos.append(
            {
                "id": photo.id,
                "url": url,
                "position": photo.position,
            }
        )
    return {
        "id": entry.id,
        "title": entry.title,
        "body": entry.body,
        "paragraphs": _paragraphs(entry.body),
        "written_at": entry.written_at,
        "photos": photos,
    }


async def _mark_stage_running(book_id: UUID, stage: str) -> None:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        if book.status == "cancelled":
            raise _BookCancelled()
        job = (
            await session.execute(
                select(BookJob).where(BookJob.book_id == book_id, BookJob.stage == stage)
            )
        ).scalar_one_or_none()
        if job is None:
            job = BookJob(book_id=book_id, stage=stage)
            session.add(job)
        job.status = "running"
        job.attempt = (job.attempt or 0) + 1
        job.started_at = _now()
        job.finished_at = None
        job.error = None
        if book.status != "completed":
            book.status = "processing"
        book.current_stage = stage
        book.started_at = book.started_at or _now()


async def _mark_stage_finished(
    book_id: UUID,
    stage: str,
    status: str,
    progress: int | None,
    *,
    meta: dict | None = None,
    error: str | None = None,
) -> None:
    async with session_scope() as session:
        job = (
            await session.execute(
                select(BookJob).where(BookJob.book_id == book_id, BookJob.stage == stage)
            )
        ).scalar_one_or_none()
        if job is not None:
            job.status = status
            job.finished_at = _now()
            job.error = error[:1000] if error else None
            if meta is not None:
                job.meta = meta
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        if progress is not None and book.status != "completed":
            book.progress = max(book.progress, progress)
        book.current_stage = (
            "completed" if book.status == "completed" and stage == "notify" else stage
        )


async def _mark_book_failed(book_id: UUID, stage: str | None, error: str) -> None:
    async with session_scope() as session:
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one_or_none()
        if book is None or book.status == "cancelled":
            return
        book.status = "failed"
        book.current_stage = stage
        book.error_message = error[:1000]
        book.completed_at = _now()


async def _raise_if_cancelled(book_id: UUID) -> None:
    async with session_scope() as session:
        status = (
            await session.execute(select(Book.status).where(Book.id == book_id))
        ).scalar_one_or_none()
        if status == "cancelled":
            raise _BookCancelled()


def _entry_summaries(entries: list[Entry]) -> list[dict]:
    return [
        {
            "id": str(entry.id),
            "date": entry.written_at.date().isoformat(),
            "text_preview": entry.body[:200],
            "word_count": _word_count(entry.body),
            "photo_count": len(entry.photos),
            "mood": entry.emotion_tags[0] if entry.emotion_tags else None,
            "has_voice_note": bool(entry.audios),
        }
        for entry in entries
    ]


def _chapter_strategy(book: Book, entry_count: int) -> str:
    period_days = _period_days(book)
    if period_days <= THEMATIC_MAX_DAYS:
        return "thematic"
    if period_days <= MONTHLY_MAX_DAYS and entry_count <= MONTHLY_ENTRY_LIMIT:
        return "monthly"
    if period_days <= YEAR_MAX_DAYS and entry_count > MONTHLY_ENTRY_LIMIT:
        return "monthly_with_quarterly_parts"
    if period_days <= YEAR_MAX_DAYS:
        return "seasonal"
    return "part_chapter"


def _period_days(book: Book) -> int:
    if not book.period_start or not book.period_end:
        return 0
    return max(1, (book.period_end.date() - book.period_start.date()).days)


def _display_end_date(book: Book):
    if not book.period_end:
        return None
    return (book.period_end - timedelta(days=1)).date()


def _detect_language(entries: list[Entry], fallback: str) -> str:
    sample = next(
        (entry.body for entry in entries if len(entry.body.split()) >= LANGUAGE_SAMPLE_MIN_WORDS),
        "",
    )
    if not sample:
        return fallback or "en"
    try:
        return detect(sample)
    except (LangDetectException, Exception):
        return fallback or "en"


def _fallback_title(book: Book, language: str) -> str:
    if (book.config or {}).get("custom_title"):
        return str((book.config or {})["custom_title"])
    if book.period_start:
        return f"Life Book {book.period_start.strftime('%Y')}"
    return "Your Life Book" if language == "en" else "Life Book"


def _fallback_subtitle(book: Book) -> str:
    if book.period_start and book.period_end:
        end = _display_end_date(book)
        return f"{book.period_start.date().isoformat()} to {end.isoformat()}"
    return "A personal journal collection"


def _part_label(label: str, strategy: str) -> str | None:
    if strategy != "part_chapter":
        return None
    return f"Part {label[:4]}"


def _chapter_title(label: str, index: int) -> str:
    if re.match(r"^\d{4}-\d{2}$", label):
        return datetime.strptime(label, "%Y-%m").strftime("%B %Y")
    return f"Chapter {index}"


def _pull_quote(body: str) -> str | None:
    for sentence in re.split(r"(?<=[.!?])\s+", body.strip()):
        words = sentence.split()
        if PULL_QUOTE_MIN_WORDS <= len(words) <= PULL_QUOTE_MAX_WORDS:
            return sentence.strip().strip('"“”')
    words = body.strip().split()
    if PULL_QUOTE_MIN_WORDS <= len(words) <= PULL_QUOTE_MAX_WORDS:
        return body.strip()
    return None


def _paragraphs(body: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", body) if part.strip()]
    return paragraphs or [body.strip()]


def _word_count(body: str) -> int:
    return len(re.findall(r"\w+", body))


def _chunks(items: list[Entry], size: int) -> list[list[Entry]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _date_or_none(value: object):  # type: ignore[no-untyped-def]
    if not value:
        return None
    if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def _storage_public_url(storage_key: str) -> str:
    if not storage_key:
        return ""
    if storage_key.startswith(("http://", "https://", "file://", "data:")):
        return storage_key
    local_path = Path(storage_key)
    if local_path.exists():
        return local_path.resolve().as_uri()
    if not _r2_configured(get_settings()):
        return ""
    # Private bucket: mint a signed GET URL so Playwright (render) and clients
    # can fetch the object without the bucket being publicly readable.
    return get_r2_storage().presign_get(storage_key)


def _is_bucket_storage_key(storage_key: str) -> bool:
    return not storage_key.startswith(("http://", "https://", "file://", "data:"))


def _r2_configured(settings) -> bool:  # type: ignore[no-untyped-def]
    # Note: r2_public_base_url is intentionally NOT required — reads now use
    # signed URLs against a private bucket, not a public base URL.
    return bool(
        settings.r2_endpoint
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
        and settings.r2_bucket
    )


def _now() -> datetime:
    return datetime.now(tz=UTC)


class _BookGenerationError(Exception):
    pass


class _BookCancelled(Exception):
    pass


class _StageSkipped(Exception):
    def __init__(self, meta: dict) -> None:
        super().__init__(str(meta))
        self.meta = meta
