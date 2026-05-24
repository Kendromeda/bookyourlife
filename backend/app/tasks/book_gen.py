from __future__ import annotations

import base64
import json
import os
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from uuid import UUID

import httpx
import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape
from openai import APIStatusError, OpenAI
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.db import session_scope
from app.models.book import Book
from app.models.entry import Entry, EntryAudio
from app.services.storage.r2 import get_r2_storage
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()

PROMPTS_DIR = Path(__file__).resolve().parents[1] / "prompts"
template_env = Environment(
    loader=FileSystemLoader(PROMPTS_DIR),
    autoescape=select_autoescape(),
    trim_blocks=True,
    lstrip_blocks=True,
)

MAX_ENTRY_CHARS = 1_200
MAX_AUDIO_TRANSCRIPTS = 8
CHAPTER_TITLES = [
    "What I Was Feeling",
    "People Who Mattered",
    "Places I Remember",
    "Things I Was Afraid Of",
    "Small Wins",
    "What Changed in Me",
]


@celery_app.task(name="app.tasks.book_gen.generate_book")
def generate_book(book_id: str) -> None:
    run_async(_run(UUID(book_id)))


async def _run(book_id: UUID) -> None:
    settings = get_settings()
    if not settings.openai_api_key:
        await _mark_failed(book_id, "OpenAI not configured")
        return

    try:
        async with session_scope() as session:
            book = (
                await session.execute(select(Book).where(Book.id == book_id))
            ).scalar_one_or_none()
            if book is None:
                return
            book.status = "processing"
            book.error = None

        async with session_scope() as session:
            book = (
                await session.execute(select(Book).where(Book.id == book_id))
            ).scalar_one()
            entries = await _load_entries(book)
            if not entries:
                raise _BookGenerationError("No entries found for this period")

        if book.include_voice_transcripts:
            await _transcribe_missing_audio(entries)

        storage = get_r2_storage()
        media_pages = _build_media_pages(entries, book.include_voice_transcripts)
        preview = _generate_preview_json(book, entries, settings)
        cover_url = None
        if book.image_mode != "none":
            cover_url = _generate_cover(book, preview, settings, storage)

        async with session_scope() as session:
            book = (
                await session.execute(select(Book).where(Book.id == book_id))
            ).scalar_one_or_none()
            if book is None:
                return
            book.status = "done"
            book.title = preview["title"]
            book.opening_letter = preview["opening_letter"]
            book.cover_image_url = cover_url
            book.generated_at = datetime.now(tz=UTC)
            book.error = None
            book.preview_data = {
                "chapters": preview["chapters"],
                "media_pages": media_pages,
                "reflection": preview["reflection"],
            }
        logger.info("book preview generated", book_id=str(book_id))
    except _BookGenerationError as exc:
        await _mark_failed(book_id, str(exc))
    except APIStatusError as exc:
        await _mark_failed(book_id, f"OpenAI error: {exc.message}")
    except Exception as exc:
        logger.warning("book preview failed", book_id=str(book_id), error=str(exc))
        await _mark_failed(book_id, str(exc))


async def _load_entries(book: Book) -> list[Entry]:
    if book.period_start is None or book.period_end is None:
        raise _BookGenerationError("Book period is missing")
    async with session_scope() as session:
        result = await session.execute(
            select(Entry)
            .where(
                Entry.user_id == book.user_id,
                Entry.written_at >= book.period_start,
                Entry.written_at < book.period_end,
            )
            .options(
                selectinload(Entry.photos),
                selectinload(Entry.videos),
                selectinload(Entry.audios),
            )
            .order_by(Entry.written_at)
        )
        return list(result.scalars().all())


def _generate_preview_json(book: Book, entries: list[Entry], settings) -> dict:  # type: ignore[no-untyped-def]
    prompt = template_env.get_template("book_preview.j2").render(
        tone=book.style,
        period_start=book.period_start.date().isoformat() if book.period_start else "",
        period_end=book.period_end.date().isoformat() if book.period_end else "",
        include_voice_transcripts=book.include_voice_transcripts,
        entries=_entries_for_prompt(entries, book.include_voice_transcripts),
    )
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model=settings.openai_model_narrative,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=3_500,
        timeout=60,
    )
    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise _BookGenerationError("OpenAI returned an empty book preview")
    payload = json.loads(content)
    return _normalize_preview_payload(payload, entries)


def _generate_cover(book: Book, preview: dict, settings, storage) -> str | None:  # type: ignore[no-untyped-def]
    mode = "abstract emotional cover" if book.image_mode == "abstract" else "photo-inspired cover"
    prompt = (
        f"Create a premium memoir book cover illustration. Title: {preview['title']}. "
        f"Tone: {book.style}. Mode: {mode}. Opening mood: {preview['opening_letter'][:500]}. "
        "No readable text, no logo, no watermark. Editorial, personal, meaningful."
    )
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.images.generate(
            model=settings.openai_model_image,
            prompt=prompt,
            n=1,
            size=settings.openai_image_size,
            timeout=120,
        )
        if not response.data:
            return None
        image_bytes = _image_data_to_bytes(response.data[0])
        # Persist the bucket key, not a signed URL — the preview serializer
        # signs it at response time (private bucket, expiring URLs).
        return storage.upload_bytes(
            key_prefix=f"book-cover/{book.id}",
            data=image_bytes,
            content_type="image/png",
        )
    except Exception as exc:
        logger.warning("book cover generation failed", book_id=str(book.id), error=str(exc))
        return None


def _entries_for_prompt(entries: list[Entry], include_voice_transcripts: bool) -> str:
    packed: list[dict] = []
    for entry in entries:
        audios = []
        if include_voice_transcripts:
            audios = [
                {"duration_seconds": audio.duration_seconds, "transcript": audio.transcript}
                for audio in entry.audios
                if audio.transcript
            ]
        packed.append(
            {
                "id": str(entry.id),
                "date": entry.written_at.date().isoformat(),
                "title": entry.title,
                "body": entry.body[:MAX_ENTRY_CHARS],
                "emotion_tags": entry.emotion_tags,
                "place_name": entry.place_name,
                "photo_count": len(entry.photos),
                "video_count": len(entry.videos),
                "audio_notes": audios,
            }
        )
    return json.dumps(packed, ensure_ascii=False)


def _build_media_pages(
    entries: list[Entry],
    include_voice_transcripts: bool,
) -> list[dict]:
    # Persist bare storage keys; the preview serializer signs them into
    # short-lived read URLs at response time (private bucket).
    pages: list[dict] = []
    for entry in entries:
        caption = entry.title or entry.written_at.date().isoformat()
        for photo in entry.photos:
            pages.append(
                {
                    "type": "photo",
                    "storage_key": photo.storage_key,
                    "entry_id": str(entry.id),
                    "caption": caption,
                }
            )
        for video in entry.videos:
            pages.append(
                {
                    "type": "video",
                    "storage_key": video.storage_key,
                    "entry_id": str(entry.id),
                    "caption": caption,
                }
            )
        for audio in entry.audios:
            pages.append(
                {
                    "type": "audio",
                    "storage_key": audio.storage_key,
                    "entry_id": str(entry.id),
                    "caption": caption,
                    "transcript": audio.transcript if include_voice_transcripts else None,
                }
            )
    return pages


async def _transcribe_missing_audio(entries: list[Entry]) -> None:
    settings = get_settings()
    if not settings.openai_api_key:
        return
    candidates = [
        audio
        for entry in entries
        for audio in entry.audios
        if not audio.transcript
    ][:MAX_AUDIO_TRANSCRIPTS]
    if not candidates:
        return
    storage = get_r2_storage()
    client = OpenAI(api_key=settings.openai_api_key)
    for audio in candidates:
        try:
            transcript = _transcribe_audio(client, settings.openai_model_whisper, storage, audio)
        except Exception as exc:
            logger.warning("book audio transcript failed", audio_id=str(audio.id), error=str(exc))
            continue
        if transcript:
            async with session_scope() as session:
                record = (
                    await session.execute(select(EntryAudio).where(EntryAudio.id == audio.id))
                ).scalar_one_or_none()
                if record is not None:
                    record.transcript = transcript
                    audio.transcript = transcript


def _transcribe_audio(client: OpenAI, model: str, storage, audio: EntryAudio) -> str | None:  # type: ignore[no-untyped-def]
    data = storage.download_bytes(audio.storage_key)
    extension = os.path.splitext(audio.storage_key)[1].lstrip(".") or "m4a"
    file_obj = BytesIO(data)
    file_obj.name = f"voice-note.{extension}"
    response = client.audio.transcriptions.create(
        model=model,
        file=file_obj,
    )
    return response.text.strip() if response.text else None


def _normalize_preview_payload(payload: dict, entries: list[Entry]) -> dict:
    entry_ids = {str(entry.id) for entry in entries}
    chapters = payload.get("chapters") if isinstance(payload.get("chapters"), list) else []
    chapters_by_title = {
        str(item.get("title") or ""): item
        for item in chapters
        if isinstance(item, dict)
    }
    normalized_chapters = []
    for title in CHAPTER_TITLES:
        item = chapters_by_title.get(title) or {}
        source_ids = [
            value for value in item.get("source_entry_ids", []) if isinstance(value, str)
        ]
        normalized_chapters.append(
            {
                "title": title,
                "narrative": str(item.get("narrative") or ""),
                "source_entry_ids": [value for value in source_ids if value in entry_ids],
                "image_url": None,
            }
        )
    raw_reflection = (
        payload.get("reflection") if isinstance(payload.get("reflection"), dict) else {}
    )
    reflection = {
        "lessons": _string_list(raw_reflection.get("lessons"))[:5],
        "moments": _string_list(raw_reflection.get("moments"))[:3],
        "carry_forward": str(raw_reflection.get("carry_forward") or ""),
        "letter_to_self": str(raw_reflection.get("letter_to_self") or ""),
    }
    return {
        "title": str(payload.get("title") or "A Season of Becoming"),
        "opening_letter": str(payload.get("opening_letter") or ""),
        "chapters": normalized_chapters,
        "reflection": reflection,
    }


async def _mark_failed(book_id: UUID, error: str) -> None:
    async with session_scope() as session:
        book = (
            await session.execute(select(Book).where(Book.id == book_id))
        ).scalar_one_or_none()
        if book is None:
            return
        book.status = "failed"
        book.error = error[:1000]


class _BookGenerationError(Exception):
    pass


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _image_data_to_bytes(image: object) -> bytes:
    b64_json = getattr(image, "b64_json", None)
    if b64_json:
        return base64.b64decode(b64_json)

    url = getattr(image, "url", None)
    if url:
        response = httpx.get(url, timeout=60)
        response.raise_for_status()
        return response.content

    raise _BookGenerationError("OpenAI returned no image bytes or image url")
