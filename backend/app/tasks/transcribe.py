"""Celery task: transcribe audio attachments via OpenAI Whisper.

Triggered after entry create when audio attachments exist. Downloads the
audio bytes from R2, sends to Whisper, persists transcript on EntryAudio.
"""
from __future__ import annotations

import asyncio
import io
import os
from uuid import UUID

import structlog
from openai import APIStatusError, OpenAI
from sqlalchemy import select

from app.config import get_settings
from app.db import session_scope
from app.models.entry import EntryAudio
from app.services.storage.r2 import get_r2_storage
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.transcribe.transcribe_audio", bind=True, max_retries=3)
def transcribe_audio_task(self, audio_id: str) -> str | None:  # noqa: ANN001
    settings = get_settings()
    if not settings.openai_api_key:
        logger.warning("openai key missing, skipping transcribe", audio_id=audio_id)
        return None

    try:
        return asyncio.run(_transcribe(UUID(audio_id), settings.openai_model_whisper))
    except _PermanentTranscribeError as exc:
        logger.warning(
            "transcribe permanent failure, not retrying",
            audio_id=audio_id,
            error=str(exc),
        )
        return None
    except APIStatusError as exc:
        # 4xx client errors (bad audio, unsupported format) shouldn't be retried.
        if 400 <= exc.status_code < 500:
            logger.warning(
                "transcribe rejected by openai, not retrying",
                audio_id=audio_id,
                status=exc.status_code,
                error=str(exc),
            )
            return None
        logger.warning("transcribe failed", audio_id=audio_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60) from exc
    except Exception as exc:
        logger.warning("transcribe failed", audio_id=audio_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60) from exc


class _PermanentTranscribeError(Exception):
    pass


async def _transcribe(audio_id: UUID, model: str) -> str | None:
    storage = get_r2_storage()

    async with session_scope() as session:
        record = (
            await session.execute(select(EntryAudio).where(EntryAudio.id == audio_id))
        ).scalar_one_or_none()
        if record is None:
            raise _PermanentTranscribeError(f"audio {audio_id} not found")
        storage_key = record.storage_key

    data = storage.download_bytes(storage_key)
    extension = os.path.splitext(storage_key)[1].lstrip(".") or "m4a"
    buffer = io.BytesIO(data)
    buffer.name = f"audio.{extension}"

    client = OpenAI(api_key=get_settings().openai_api_key)
    response = client.audio.transcriptions.create(
        model=model,
        file=buffer,
    )
    transcript = response.text.strip() if response.text else None

    if transcript:
        async with session_scope() as session:
            record = (
                await session.execute(select(EntryAudio).where(EntryAudio.id == audio_id))
            ).scalar_one_or_none()
            if record is not None:
                record.transcript = transcript
                await session.commit()

    logger.info("audio transcribed", audio_id=str(audio_id), chars=len(transcript or ""))
    return transcript
