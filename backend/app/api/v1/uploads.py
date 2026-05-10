from typing import Annotated

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.deps import CurrentUser
from app.schemas.entry import DirectUploadOut, PresignedUploadOut
from app.services.storage.r2 import get_r2_storage

router = APIRouter()
logger = structlog.get_logger()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_VIDEO_BYTES = 100 * 1024 * 1024
MAX_AUDIO_BYTES = 25 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-m4v", "video/3gpp"}
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/aac",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/3gpp",
    "audio/webm",
    "audio/ogg",
}


class PresignedRequestIn(BaseModel):
    purpose: str = Field(default="entry-photo", pattern="^(entry-photo|face-photo)$")
    content_type: str = Field(default="image/jpeg", pattern="^image/(jpeg|png|webp)$")


@router.post("/photo", response_model=PresignedUploadOut)
async def presign_photo(payload: PresignedRequestIn, user: CurrentUser) -> PresignedUploadOut:
    storage = get_r2_storage()
    prefix = f"{payload.purpose}/{user.id}"
    try:
        upload_url, storage_key = storage.presign_put(
            key_prefix=prefix,
            content_type=payload.content_type,
            expires_in=600,
        )
    except Exception as exc:
        logger.exception("r2 presign failed", user_id=str(user.id), purpose=payload.purpose)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Storage tidak tersedia"
        ) from exc
    return PresignedUploadOut(
        upload_url=upload_url,
        storage_key=storage_key,
        expires_in_seconds=600,
    )


@router.post("/photo/direct", response_model=DirectUploadOut)
async def upload_photo_direct(
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
    purpose: Annotated[str, Form(pattern="^(entry-photo|face-photo)$")] = "entry-photo",
) -> DirectUploadOut:
    return await _upload_direct(
        user_id=str(user.id),
        file=file,
        prefix=f"{purpose}/{user.id}",
        allowed=ALLOWED_IMAGE_TYPES,
        max_bytes=MAX_IMAGE_BYTES,
        kind_label="image",
    )


@router.post("/video/direct", response_model=DirectUploadOut)
async def upload_video_direct(
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
) -> DirectUploadOut:
    return await _upload_direct(
        user_id=str(user.id),
        file=file,
        prefix=f"entry-video/{user.id}",
        allowed=ALLOWED_VIDEO_TYPES,
        max_bytes=MAX_VIDEO_BYTES,
        kind_label="video",
    )


@router.post("/audio/direct", response_model=DirectUploadOut)
async def upload_audio_direct(
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
) -> DirectUploadOut:
    return await _upload_direct(
        user_id=str(user.id),
        file=file,
        prefix=f"entry-audio/{user.id}",
        allowed=ALLOWED_AUDIO_TYPES,
        max_bytes=MAX_AUDIO_BYTES,
        kind_label="audio",
    )


_CHUNK_SIZE = 1024 * 1024  # 1 MiB


async def _upload_direct(
    *,
    user_id: str,
    file: UploadFile,
    prefix: str,
    allowed: set[str],
    max_bytes: int,
    kind_label: str,
) -> DirectUploadOut:
    content_type = _normalize_content_type(file.content_type)
    if content_type not in allowed:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported {kind_label} type",
        )

    declared_size = file.size
    if declared_size is not None and declared_size > max_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"{kind_label.title()} is too large",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"{kind_label.title()} is too large",
            )
        chunks.append(chunk)
    data = b"".join(chunks)

    storage = get_r2_storage()
    try:
        storage_key = await run_in_threadpool(
            storage.upload_bytes,
            key_prefix=prefix,
            data=data,
            content_type=content_type,
        )
    except Exception as exc:
        logger.exception(
            "r2 direct upload failed",
            user_id=user_id,
            kind=kind_label,
            content_type=content_type,
            size=len(data),
        )
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Storage tidak tersedia"
        ) from exc

    return DirectUploadOut(
        storage_key=storage_key,
        public_url=storage.public_url(storage_key),
    )


def _normalize_content_type(content_type: str | None) -> str:
    if not content_type:
        return "application/octet-stream"
    return content_type.split(";", 1)[0].strip().lower()
