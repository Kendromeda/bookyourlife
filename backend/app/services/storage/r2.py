from functools import lru_cache
from uuid import uuid4

import boto3
from botocore.client import Config

from app.config import get_settings


class R2Storage:
    """Cloudflare R2 wrapper (S3-compatible)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.r2_bucket
        self._public_base = settings.r2_public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def presign_put(
        self,
        *,
        key_prefix: str,
        content_type: str = "image/jpeg",
        expires_in: int = 600,
    ) -> tuple[str, str]:
        """Mengembalikan (upload_url, storage_key)."""
        storage_key = f"{key_prefix}/{uuid4().hex}.jpg"
        url = self._client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self._bucket,
                "Key": storage_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )
        return url, storage_key

    def upload_bytes(
        self,
        *,
        key_prefix: str,
        data: bytes,
        content_type: str = "image/jpeg",
    ) -> str:
        extension = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
        }.get(content_type, "jpg")
        storage_key = f"{key_prefix}/{uuid4().hex}.{extension}"
        self._client.put_object(
            Bucket=self._bucket,
            Key=storage_key,
            Body=data,
            ContentType=content_type,
        )
        return storage_key

    def public_url(self, storage_key: str) -> str:
        return f"{self._public_base}/{storage_key}"


@lru_cache
def get_r2_storage() -> R2Storage:
    return R2Storage()
