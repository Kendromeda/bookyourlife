from functools import lru_cache
from uuid import uuid4

import boto3
from botocore.client import Config

from app.config import get_settings

# Default lifetime for signed read URLs. The bucket is private; clients and
# the PDF renderer must fetch objects via these short-lived signed URLs, so a
# leaked URL stops working quickly. 1h comfortably covers mobile display
# (re-fetched on reload) and server-side PDF rendering (completes in minutes).
READ_URL_TTL_SECONDS = 3600


class R2Storage:
    """Cloudflare R2 wrapper (S3-compatible)."""

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.r2_bucket
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
        storage_key = f"{key_prefix}/{uuid4().hex}.{_extension_for(content_type)}"
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
        storage_key = f"{key_prefix}/{uuid4().hex}.{_extension_for(content_type)}"
        self._client.put_object(
            Bucket=self._bucket,
            Key=storage_key,
            Body=data,
            ContentType=content_type,
        )
        return storage_key

    def presign_get(
        self, storage_key: str, *, expires_in: int = READ_URL_TTL_SECONDS
    ) -> str:
        """Short-lived signed GET URL for a private-bucket object."""
        url: str = self._client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": self._bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )
        return url

    def download_bytes(self, storage_key: str) -> bytes:
        obj = self._client.get_object(Bucket=self._bucket, Key=storage_key)
        return obj["Body"].read()

    def delete_objects(self, storage_keys: list[str]) -> None:
        unique_keys = sorted({key for key in storage_keys if key})
        for index in range(0, len(unique_keys), 1000):
            chunk = unique_keys[index : index + 1000]
            response = self._client.delete_objects(
                Bucket=self._bucket,
                Delete={
                    "Objects": [{"Key": key} for key in chunk],
                    "Quiet": True,
                },
            )
            errors = response.get("Errors", [])
            if errors:
                messages = ", ".join(
                    f"{item.get('Key')}: {item.get('Message')}" for item in errors
                )
                raise RuntimeError(f"R2 delete failed: {messages}")

    def public_url(self, storage_key: str) -> str:
        """Back-compat name — now returns a short-lived signed read URL.

        Kept so existing callers (`storage.public_url(key)`) automatically
        emit signed URLs against the private bucket. Use `media_read_url`
        directly for values that may already be absolute URLs.
        """
        return media_read_url(storage_key)


_EXTENSION_BY_TYPE: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/3gpp": "3gp",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/3gpp": "3gp",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "application/pdf": "pdf",
}


def _extension_for(content_type: str) -> str:
    return _EXTENSION_BY_TYPE.get(content_type, "bin")


def media_read_url(value: str, *, expires_in: int = READ_URL_TTL_SECONDS) -> str:
    """Resolve a stored media reference into a usable read URL.

    - empty -> "" (nothing to show)
    - already-absolute (http(s)/file/data) -> passthrough (legacy rows,
      local-dev file URIs)
    - otherwise treat as a private-bucket key -> short-lived signed GET URL
    """
    if not value:
        return ""
    if value.startswith(("http://", "https://", "file://", "data:")):
        return value
    return get_r2_storage().presign_get(value, expires_in=expires_in)


@lru_cache
def get_r2_storage() -> R2Storage:
    return R2Storage()
