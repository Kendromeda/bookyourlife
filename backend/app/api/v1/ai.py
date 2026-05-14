"""AI tools endpoints: title suggestions, writing prompts, highlights, image gen.

Text tools call GPT-4o synchronously (typically <2s). Per CLAUDE.md, calls
>2s should run via Celery; OpenAI chat completions for short journaling
prompts are well under that threshold so we keep them in the request path.

Image gen runs through Celery (`app.tasks.image_gen`) and is polled via
GET /ai/image-gen/{job_id}.
"""
from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, status
from jinja2 import Environment, FileSystemLoader, select_autoescape
from openai import APIStatusError, OpenAI
from sqlalchemy import select

from app.config import get_settings
from app.deps import CurrentUser, SessionDep
from app.models.ai_image_job import AiImageJob, AiImageJobStatus
from app.schemas.ai import (
    AiDiagnosticsResponse,
    HighlightsRequest,
    HighlightsResponse,
    ImageGenRequest,
    ImageGenResponse,
    ImageJobStatusResponse,
    TitleSuggestionsRequest,
    TitleSuggestionsResponse,
    WritingPromptsRequest,
    WritingPromptsResponse,
)
from app.services.storage.r2 import get_r2_storage
from app.tasks.celery_app import celery_app
from app.tasks.image_gen import generate_image

router = APIRouter(prefix="/ai")
logger = structlog.get_logger()

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
template_env = Environment(
    loader=FileSystemLoader(PROMPTS_DIR),
    autoescape=select_autoescape(),
    trim_blocks=True,
    lstrip_blocks=True,
)


def _render_prompt(template_name: str, **context: object) -> str:
    return template_env.get_template(template_name).render(**context)


def _chat_json(template_name: str, body: str) -> dict:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "OpenAI not configured"
        )

    prompt = _render_prompt(template_name, body=body)
    client = OpenAI(api_key=settings.openai_api_key)

    try:
        response = client.chat.completions.create(
            model=settings.openai_model_question,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=512,
            timeout=20,
        )
    except APIStatusError as exc:
        logger.warning("openai chat failed", template=template_name, error=str(exc))
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "AI service unavailable"
        ) from exc

    content = response.choices[0].message.content if response.choices else None
    if not content:
        return {}
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _string_list(payload: dict, key: str) -> list[str]:
    value = payload.get(key)
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _queue_reachable() -> bool:
    try:
        conn = celery_app.connection_for_write()
        conn.ensure_connection(max_retries=1)
        conn.release()
        return True
    except Exception as exc:
        logger.warning("celery diagnostics failed", error=str(exc))
        return False


@router.get("/diagnostics", response_model=AiDiagnosticsResponse)
async def diagnostics(user: CurrentUser) -> AiDiagnosticsResponse:
    settings = get_settings()
    return AiDiagnosticsResponse(
        openai_configured=bool(settings.openai_api_key),
        r2_configured=bool(
            settings.r2_endpoint
            and settings.r2_access_key_id
            and settings.r2_secret_access_key
            and settings.r2_bucket
            and settings.r2_public_base_url
        ),
        image_model=settings.openai_model_image,
        image_size=settings.openai_image_size,
        queue_reachable=_queue_reachable(),
    )


@router.post("/title-suggestions", response_model=TitleSuggestionsResponse)
async def title_suggestions(
    request: TitleSuggestionsRequest,
    user: CurrentUser,
) -> TitleSuggestionsResponse:
    payload = _chat_json("title_suggestions.j2", request.body)
    return TitleSuggestionsResponse(titles=_string_list(payload, "titles")[:3])


@router.post("/writing-prompts", response_model=WritingPromptsResponse)
async def writing_prompts(
    request: WritingPromptsRequest,
    user: CurrentUser,
) -> WritingPromptsResponse:
    payload = _chat_json("writing_prompts.j2", request.body)
    return WritingPromptsResponse(prompts=_string_list(payload, "prompts")[:3])


@router.post("/highlights", response_model=HighlightsResponse)
async def highlights(
    request: HighlightsRequest,
    user: CurrentUser,
) -> HighlightsResponse:
    payload = _chat_json("highlights.j2", request.body)
    return HighlightsResponse(highlights=_string_list(payload, "highlights")[:5])


@router.post("/image-gen", response_model=ImageGenResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_image_gen(
    request: ImageGenRequest,
    user: CurrentUser,
    session: SessionDep,
) -> ImageGenResponse:
    rendered_prompt = _render_prompt(
        "image_memory_visual.j2",
        body=request.body.strip(),
        prompt=(request.prompt or "").strip(),
        style=request.style,
        intensity=request.intensity,
        purpose=request.purpose,
    )
    job = AiImageJob(
        user_id=user.id,
        status=AiImageJobStatus.pending,
        prompt=rendered_prompt,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    try:
        generate_image.delay(str(job.id), rendered_prompt)
    except Exception as exc:
        logger.warning("image_gen enqueue failed", job_id=str(job.id), error=str(exc))
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Image queue unavailable"
        ) from exc

    return ImageGenResponse(job_id=str(job.id))


@router.get("/image-gen/{job_id}", response_model=ImageJobStatusResponse)
async def image_gen_status(
    job_id: UUID,
    user: CurrentUser,
    session: SessionDep,
) -> ImageJobStatusResponse:
    stmt = select(AiImageJob).where(AiImageJob.id == job_id)
    job = (await session.execute(stmt)).scalar_one_or_none()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image job not found")
    if job.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    public_url: str | None = None
    if job.storage_key:
        public_url = get_r2_storage().public_url(job.storage_key)

    return ImageJobStatusResponse(
        status=job.status.value if hasattr(job.status, "value") else str(job.status),
        storage_key=job.storage_key,
        public_url=public_url,
        error=job.error,
    )
