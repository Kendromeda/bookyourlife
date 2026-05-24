"""Storage-key ownership validation.

Clients send raw R2 storage keys (from presigned uploads) back to the API
when attaching media to entries / profile / AI jobs. Those keys must be
proven to belong to the calling user, otherwise a client could reference
another user's objects by guessing their path (IDOR).

All upload prefixes are built as ``{purpose}/{user_id}/...`` (see
``app/api/v1/uploads.py``), so ownership is a prefix check. This module is
the single source of truth for that check — reused by the entries service,
the profile update endpoint, and AI image generation.
"""

from uuid import UUID

# Upload purposes — must match the presign whitelist in uploads.py and the
# key prefixes built by the storage service / pipeline tasks.
PURPOSE_ENTRY_PHOTO = "entry-photo"
PURPOSE_ENTRY_VIDEO = "entry-video"
PURPOSE_ENTRY_AUDIO = "entry-audio"
PURPOSE_FACE_PHOTO = "face-photo"
PURPOSE_AI_REFERENCE = "ai-reference"


class StorageKeyOwnershipError(ValueError):
    """A storage key is not owned by the user or not an allowed purpose.

    Subclasses ``ValueError`` so service-layer code can raise it without
    importing FastAPI; the API layer maps it to HTTP 403 via an exception
    handler registered in ``app.main``.
    """


def _is_http_url(storage_key: str) -> bool:
    return storage_key.startswith(("http://", "https://"))


def assert_owned_storage_key(
    storage_key: str,
    user_id: UUID,
    *,
    allowed_purposes: tuple[str, ...],
    allow_http_passthrough: bool = False,
) -> str:
    """Return ``storage_key`` if owned by ``user_id``, else raise.

    ``allow_http_passthrough`` accepts already-public ``http(s)://`` values
    unchanged — used for fields (e.g. ``face_photo_url``) that may still hold
    a legacy absolute URL rather than a bucket key.
    """
    if allow_http_passthrough and _is_http_url(storage_key):
        return storage_key
    allowed_prefixes = tuple(f"{purpose}/{user_id}/" for purpose in allowed_purposes)
    if not storage_key.startswith(allowed_prefixes):
        raise StorageKeyOwnershipError("Storage key is not owned by the requesting user")
    return storage_key
