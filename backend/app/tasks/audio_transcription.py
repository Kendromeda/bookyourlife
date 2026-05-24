"""Celery task: transcribe uploaded entry audio for premium users."""
from __future__ import annotations

import os
from io import BytesIO
from uuid import UUID

import structlog
from celery.exceptions import MaxRetriesExceededError
from openai import APIStatusError, OpenAI
from sqlalchemy import select

from app.config import get_settings
from app.db import session_scope
from app.models.audio_transcription_job import AudioTranscriptionJob
from app.services.storage.r2 import get_r2_storage
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()

HTTP_CLIENT_ERROR_MIN = 400
HTTP_SERVER_ERROR_MIN = 500
OPENAI_TRANSCRIPTION_TIMEOUT_SECONDS = 180


@celery_app.task(name="app.tasks.audio_transcription.transcribe_audio", bind=True, max_retries=2)
def transcribe_audio(self, job_id: str) -> None:  # type: ignore[no-untyped-def]
    settings = get_settings()
    if not settings.openai_api_key:
        run_async(_mark_failed(UUID(job_id), "OpenAI not configured"))
        return

    try:
        run_async(_run(UUID(job_id)))
    except _PermanentError as exc:
        logger.warning("audio transcription permanent failure", job_id=job_id, error=str(exc))
        run_async(_mark_failed(UUID(job_id), str(exc)))
    except APIStatusError as exc:
        if HTTP_CLIENT_ERROR_MIN <= exc.status_code < HTTP_SERVER_ERROR_MIN:
            logger.warning(
                "audio transcription rejected by openai",
                job_id=job_id,
                status=exc.status_code,
                error=str(exc),
            )
            run_async(_mark_failed(UUID(job_id), str(exc)))
            return
        logger.warning("audio transcription failed, retrying", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, countdown=20) from exc
    except Exception as exc:
        logger.warning("audio transcription failed", job_id=job_id, error=str(exc))
        try:
            raise self.retry(exc=exc, countdown=20) from exc
        except MaxRetriesExceededError:
            run_async(_mark_failed(UUID(job_id), str(exc)))


class _PermanentError(Exception):
    pass


async def _run(job_id: UUID) -> None:
    settings = get_settings()
    async with session_scope() as session:
        job = (
            await session.execute(
                select(AudioTranscriptionJob).where(AudioTranscriptionJob.id == job_id)
            )
        ).scalar_one_or_none()
        if job is None:
            raise _PermanentError(f"job {job_id} not found")
        job.status = "processing"
        job.error = None
        storage_key = job.storage_key

    storage = get_r2_storage()
    data = storage.download_bytes(storage_key)
    extension = os.path.splitext(storage_key)[1].lstrip(".") or "m4a"
    file_obj = BytesIO(data)
    file_obj.name = f"voice-note.{extension}"

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.audio.transcriptions.create(
        model=settings.openai_model_whisper,
        file=file_obj,
        timeout=OPENAI_TRANSCRIPTION_TIMEOUT_SECONDS,
    )
    transcript = response.text.strip() if response.text else ""
    if not transcript:
        raise _PermanentError("No transcript returned")

    async with session_scope() as session:
        job = (
            await session.execute(
                select(AudioTranscriptionJob).where(AudioTranscriptionJob.id == job_id)
            )
        ).scalar_one_or_none()
        if job is None:
            raise _PermanentError(f"job {job_id} disappeared after transcription")
        job.status = "done"
        job.transcript = transcript
        job.error = None

    logger.info("audio transcription completed", job_id=str(job_id))


async def _mark_failed(job_id: UUID, error: str) -> None:
    async with session_scope() as session:
        job = (
            await session.execute(
                select(AudioTranscriptionJob).where(AudioTranscriptionJob.id == job_id)
            )
        ).scalar_one_or_none()
        if job is None:
            return
        job.status = "failed"
        job.error = error[:1000]
