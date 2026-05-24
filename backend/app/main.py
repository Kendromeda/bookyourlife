from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1 import router as v1_router
from app.config import Settings, get_settings
from app.rate_limit import limiter
from app.services.storage.ownership import StorageKeyOwnershipError

logger = structlog.get_logger()


def _resolve_cors_origins(settings: Settings) -> list[str]:
    """Return CORS origins, refusing the unsafe wildcard in production.

    ``allow_origins=["*"]`` combined with ``allow_credentials=True`` is an
    invalid/unsafe CORS configuration. Native mobile clients don't send an
    Origin header, so an empty list is fine (mobile-only); only web clients
    need explicit origins.
    """
    origins = settings.cors_origins
    if settings.environment == "production" and "*" in origins:
        raise RuntimeError(
            "CORS misconfiguration: wildcard '*' origin is not allowed in production. "
            "Set CORS_ORIGINS to an explicit list of web origins."
        )
    return origins


@asynccontextmanager
async def lifespan(_: FastAPI):  # type: ignore[no-untyped-def]
    settings = get_settings()
    logger.info("startup", environment=settings.environment)
    yield
    logger.info("shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Life Book API",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    # slowapi's handler signature is narrower than Starlette's expected type.
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_resolve_cors_origins(settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(StorageKeyOwnershipError)
    async def _storage_ownership_handler(
        _request: Request, exc: StorageKeyOwnershipError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(exc)}
        )

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, Any]:
        return {"status": "ok", "environment": settings.environment}

    app.include_router(v1_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
