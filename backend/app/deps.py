import httpx
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models.user import User
from app.services.users import get_or_create_user

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@lru_cache
def _get_clerk_jwks(jwks_url: str) -> dict:  # type: ignore[type-arg]
    resp = httpx.get(jwks_url, timeout=10)
    resp.raise_for_status()
    return resp.json()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: SessionDep = ...,  # type: ignore[assignment]
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = authorization.split(" ", 1)[1]
    settings = get_settings()

    try:
        jwks = _get_clerk_jwks(settings.clerk_jwks_url)
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    clerk_id: str | None = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token claims")

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
