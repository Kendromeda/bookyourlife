import time
from typing import Annotated, Any

import httpx
from fastapi import Depends, Header, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.services.users import get_or_create_user

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

Jwks = dict[str, Any]

# JWKS cache: url -> (jwks, fetched_at_monotonic). Replaces a permanent
# lru_cache so Clerk signing-key rotation is picked up without a restart.
_jwks_cache: dict[str, tuple[Jwks, float]] = {}
_jwks_last_forced_refresh: dict[str, float] = {}
# Throttle forced refreshes so a flood of invalid tokens can't amplify into
# a flood of outbound JWKS fetches.
_JWKS_MIN_FORCED_REFRESH_SECONDS = 60.0


def _fetch_jwks(jwks_url: str) -> Jwks:
    resp = httpx.get(jwks_url, timeout=10)
    resp.raise_for_status()
    data: Jwks = resp.json()
    return data


def _get_clerk_jwks(jwks_url: str, *, force_refresh: bool = False) -> Jwks:
    now = time.monotonic()
    cached = _jwks_cache.get(jwks_url)
    if force_refresh:
        last = _jwks_last_forced_refresh.get(jwks_url, 0.0)
        if cached is not None and (now - last) < _JWKS_MIN_FORCED_REFRESH_SECONDS:
            return cached[0]
        _jwks_last_forced_refresh[jwks_url] = now
    elif cached is not None and (now - cached[1]) < get_settings().clerk_jwks_cache_seconds:
        return cached[0]
    jwks = _fetch_jwks(jwks_url)
    _jwks_cache[jwks_url] = (jwks, now)
    return jwks


def _decode_clerk_token(token: str, jwks: Jwks, settings: Settings) -> dict[str, Any]:
    kwargs: dict[str, Any] = {}
    if settings.clerk_issuer:
        kwargs["issuer"] = settings.clerk_issuer
    if settings.clerk_audience:
        kwargs["audience"] = settings.clerk_audience
    claims: dict[str, Any] = jwt.decode(
        token,
        jwks,
        algorithms=["RS256"],
        options={"verify_aud": bool(settings.clerk_audience)},
        **kwargs,
    )
    return claims


async def get_current_user(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    session: SessionDep = ...,  # type: ignore[assignment]
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.split(" ", 1)[1]
    settings = get_settings()

    try:
        jwks = _get_clerk_jwks(settings.clerk_jwks_url)
        payload = _decode_clerk_token(token, jwks, settings)
    except JWTError:
        # Could be a rotated signing key the cache hasn't seen — refresh once.
        try:
            jwks = _get_clerk_jwks(settings.clerk_jwks_url, force_refresh=True)
            payload = _decode_clerk_token(token, jwks, settings)
        except JWTError as exc:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    # Authorized party (`azp`) — when configured, the token must come from a
    # known Clerk frontend origin.
    if settings.clerk_authorized_parties:
        azp = payload.get("azp")
        if not azp or azp not in settings.clerk_authorized_parties:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized party")

    clerk_id: str | None = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token claims")

    # Expose the authenticated identity to the rate limiter key function so
    # limits are scoped per-user (not per shared NAT IP).
    request.state.clerk_id = clerk_id

    email: str | None = payload.get("email") or (
        payload.get("email_addresses", [{}])[0].get("email_address")
        if isinstance(payload.get("email_addresses"), list)
        else None
    )
    display_name: str | None = (
        f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip() or None
    )

    return await get_or_create_user(
        session,
        clerk_id=clerk_id,
        email=email,
        display_name=display_name,
    )


CurrentUser = Annotated[User, Depends(get_current_user)]
