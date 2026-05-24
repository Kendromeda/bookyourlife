"""Rate limiting (slowapi).

Protects expensive / abusable endpoints (uploads, AI calls, book generation,
data export) against runaway cost and DoS. Keyed by the authenticated Clerk
user when available (set on ``request.state`` by ``get_current_user``), falling
back to client IP for unauthenticated requests.

Storage defaults to in-process memory (fine for dev/test and single-process
runs); set ``RATE_LIMIT_STORAGE_URI`` to the Redis URL in production so limits
are shared across worker processes.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import get_settings

_settings = get_settings()


def _rate_limit_key(request: Request) -> str:
    clerk_id = getattr(request.state, "clerk_id", None)
    if clerk_id:
        return f"user:{clerk_id}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=_rate_limit_key,
    storage_uri=_settings.rate_limit_storage_uri,
    enabled=_settings.rate_limit_enabled,
    # Header injection requires every limited route to expose a `response`
    # param; we return Pydantic models, so keep it off. Limiting still applies.
    headers_enabled=False,
)
