from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.deps import CurrentUser
from app.schemas.entry import DirectUploadOut, PresignedUploadOut
from app.services.storage.r2 import get_r2_storage

router = APIRouter()
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


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
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported image type")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image is too large")

    storage = get_r2_storage()
    prefix = f"{purpose}/{user.id}"
    try:
        storage_key = storage.upload_bytes(
            key_prefix=prefix,
            data=data,
            content_type=file.content_type or "image/jpeg",
        )
    except Exception as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Storage tidak tersedia"
        ) from exc

    return DirectUploadOut(
        storage_key=storage_key,
        public_url=storage.public_url(storage_key),
    )
