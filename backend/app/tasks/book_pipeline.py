from __future__ import annotations

import json
import re
import tempfile
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import anyio
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


@celery_app.task(name="app.tasks.book_gen.generate_book_pipeline")
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
        plan_payload = dict(plan.plan or {})
        plan_payload["preface"] = generated_texts["preface"]
        plan_payload["epilog"] = generated_texts["epilog"]
        plan.plan = plan_payload

        intros = generated_texts["chapter_intros"]
        for chapter in chapters:
            chapter.intro_text = intros.get(str(chapter.position), chapter.theme or "")

        await session.execute(delete(EntryEnhancement).where(EntryEnhancement.book_id == book_id))
        for entry in entries:
            enhancement = _fallback_enhancement(book, entry)
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
    async with session_scope() as session:
        await session.execute(delete(GeneratedAsset).where(GeneratedAsset.book_id == book_id))
        book = (await session.execute(select(Book).where(Book.id == book_id))).scalar_one()
        entries = await _load_entries_for_book(book, session)
        chapters = list(
            (
                await session.execute(select(BookChapter).where(BookChapter.book_id == book_id))
            )
            .scalars()
            .all()
        )
        title = book.title or "Untitled Book"
        session.add(
            GeneratedAsset(
                book_id=book_id,
                asset_type="cover",
                ref_id=book_id,
                prompt=f"Scrapbook memoir cover for {title}",
                provider="fallback",
                model="paper-texture",
                status="failed_fallback",
                fallback_strategy="paper_texture_placeholder",
            )
        )
        for chapter in chapters:
            session.add(
                GeneratedAsset(
                    book_id=book_id,
                    asset_type="chapter_opener",
                    ref_id=chapter.id,
                    prompt=f"Chapter opener illustration for {chapter.title}",
                    provider="fallback",
                    model="paper-texture",
                    status="failed_fallback",
                    fallback_strategy="paper_texture_placeholder",
                )
            )
        no_photo_count = 0
        for entry in entries:
            if entry.photos:
                continue
            no_photo_count += 1
            session.add(
                GeneratedAsset(
                    book_id=book_id,
                    asset_type="entry_image",
                    ref_id=entry.id,
                    prompt=(
                        "Margin illustration for entry on "
                        f"{entry.written_at.date().isoformat()}"
                    ),
                    provider="fallback",
                    model="paper-texture",
                    status="failed_fallback",
                    fallback_strategy="paper_texture_placeholder",
                )
            )
    return {"chapter_openers": len(chapters), "entry_images": no_photo_count}


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
            pdf_url = storage.public_url(pdf_key)
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
    if settings.openai_api_key:
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
    if settings.openai_api_key:
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

    entry_by_id = {entry.id: _entry_render_data(entry) for entry in entries}
    enhancement_by_entry = {item.entry_id: item for item in enhancements}
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
        dedication=(book.config or {}).get("dedication"),
        generated_at=_now().date().isoformat(),
    )


async def _render_html_to_pdf(html: str) -> bytes:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="load")
        pdf_bytes = await page.pdf(
            format="A5",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            prefer_css_page_size=True,
        )
        await browser.close()
        return pdf_bytes


def _entry_render_data(entry: Entry) -> dict:
    return {
        "id": entry.id,
        "title": entry.title,
        "body": entry.body,
        "paragraphs": _paragraphs(entry.body),
        "written_at": entry.written_at,
        "photos": [
            {
                "id": photo.id,
                "url": _storage_public_url(photo.storage_key),
                "position": photo.position,
            }
            for photo in entry.photos
        ],
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
    if storage_key.startswith("http"):
        return storage_key
    settings = get_settings()
    if not settings.r2_public_base_url:
        return storage_key
    return f"{settings.r2_public_base_url.rstrip('/')}/{storage_key}"


def _r2_configured(settings) -> bool:  # type: ignore[no-untyped-def]
    return bool(
        settings.r2_endpoint
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
        and settings.r2_bucket
        and settings.r2_public_base_url
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
