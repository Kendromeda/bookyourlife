from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.deps import CurrentUser
from app.schemas.entry import PresignedUploadOut
from app.services.storage.r2 import get_r2_storage

router = APIRouter()


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
