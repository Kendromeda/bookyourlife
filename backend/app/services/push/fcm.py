from __future__ import annotations

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_token import DeviceToken

logger = structlog.get_logger()

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class FcmService:
    @staticmethod
    async def register_token(
        session: AsyncSession,
        *,
        user_id,
        token: str,
        platform: str = "android",
    ) -> DeviceToken:
        stmt = select(DeviceToken).where(DeviceToken.token == token)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            existing.user_id = user_id
            existing.platform = platform
            await session.commit()
            await session.refresh(existing)
            return existing

        record = DeviceToken(user_id=user_id, token=token, platform=platform)
        session.add(record)
        try:
            await session.commit()
            await session.refresh(record)
        except IntegrityError:
            await session.rollback()
            raise
        return record

    @staticmethod
    async def tokens_for_user(session: AsyncSession, user_id) -> list[str]:
        stmt = select(DeviceToken.token).where(DeviceToken.user_id == user_id)
        return list((await session.execute(stmt)).scalars().all())

    @staticmethod
    def send(
        *,
        tokens: list[str],
        title: str,
        body: str,
        deep_link: str | None = None,
    ) -> int:
        if not tokens:
            return 0

        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                **({"data": {"deep_link": deep_link}} if deep_link else {}),
                "sound": "default",
                "priority": "high",
            }
            for token in tokens
        ]

        try:
            response = httpx.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()
            success = sum(
                1 for item in data.get("data", []) if item.get("status") == "ok"
            )
            failures = len(messages) - success
            if failures:
                logger.warning("expo_push partial failure", success=success, failure=failures)
            return success
        except Exception as exc:
            logger.error("expo_push failed", error=str(exc))
            return 0
