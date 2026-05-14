"""Celery task: generate image via OpenAI GPT Image + upload to R2.

Updates an AiImageJob row through pending -> processing -> done/failed.
"""
from __future__ import annotations

import base64
from uuid import UUID

import httpx
import structlog
from openai import APIStatusError, OpenAI
from sqlalchemy import select

from app.config import get_settings
from app.db import session_scope
from app.models.ai_image_job import AiImageJob, AiImageJobStatus
from app.services.storage.r2 import get_r2_storage
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()

HTTP_CLIENT_ERROR_MIN = 400
HTTP_SERVER_ERROR_MIN = 500


@celery_app.task(name="app.tasks.image_gen.generate_image", bind=True, max_retries=2)
def generate_image(self, job_id: str, prompt: str) -> None:
    settings = get_settings()
    if not settings.openai_api_key:
        logger.warning("openai key missing, marking failed", job_id=job_id)
        run_async(_mark_failed(UUID(job_id), "OpenAI not configured"))
        return

    try:
        run_async(_run(UUID(job_id), prompt))
    except _PermanentError as exc:
        logger.warning("image gen permanent failure", job_id=job_id, error=str(exc))
        run_async(_mark_failed(UUID(job_id), str(exc)))
    except APIStatusError as exc:
        if HTTP_CLIENT_ERROR_MIN <= exc.status_code < HTTP_SERVER_ERROR_MIN:
            logger.warning(
                "image gen rejected by openai",
                job_id=job_id,
                status=exc.status_code,
                error=str(exc),
            )
            run_async(_mark_failed(UUID(job_id), str(exc)))
            return
        logger.warning("image gen failed, retrying", job_id=job_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30) from exc
    except Exception as exc:
        logger.warning("image gen failed", job_id=job_id, error=str(exc))
        try:
            raise self.retry(exc=exc, countdown=30) from exc
        except Exception:
            run_async(_mark_failed(UUID(job_id), str(exc)))


class _PermanentError(Exception):
    pass


async def _run(job_id: UUID, prompt: str) -> None:
    settings = get_settings()

    async with session_scope() as session:
        job = (
            await session.execute(select(AiImageJob).where(AiImageJob.id == job_id))
        ).scalar_one_or_none()
        if job is None:
            raise _PermanentError(f"job {job_id} not found")
        job.status = AiImageJobStatus.processing
        job.error = None

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.images.generate(
        model=settings.openai_model_image,
        prompt=prompt,
        n=1,
        size=settings.openai_image_size,
        timeout=120,
    )

    if not response.data:
        raise _PermanentError("openai returned no image data")
    image_bytes = _image_data_to_bytes(response.data[0])

    storage = get_r2_storage()
    storage_key = storage.upload_bytes(
        key_prefix=f"ai-image/{job_id}",
        data=image_bytes,
        content_type="image/png",
    )

    async with session_scope() as session:
        job = (
            await session.execute(select(AiImageJob).where(AiImageJob.id == job_id))
        ).scalar_one_or_none()
        if job is None:
            raise _PermanentError(f"job {job_id} disappeared after generation")
        job.status = AiImageJobStatus.done
        job.storage_key = storage_key
        job.error = None

    logger.info("image generated", job_id=str(job_id))


async def _mark_failed(job_id: UUID, error: str) -> None:
    async with session_scope() as session:
        job = (
            await session.execute(select(AiImageJob).where(AiImageJob.id == job_id))
        ).scalar_one_or_none()
        if job is None:
            return
        job.status = AiImageJobStatus.failed
        job.error = error[:1000]


def _image_data_to_bytes(image: object) -> bytes:
    b64_json = getattr(image, "b64_json", None)
    if b64_json:
        return base64.b64decode(b64_json)

    url = getattr(image, "url", None)
    if url:
        response = httpx.get(url, timeout=60)
        response.raise_for_status()
        return response.content

    raise _PermanentError("openai returned no image bytes or image url")
