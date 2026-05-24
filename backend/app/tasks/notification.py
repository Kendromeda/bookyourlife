from uuid import UUID

import structlog

from app.db import session_scope
from app.services.push.fcm import FcmService
from app.tasks.async_runner import run_async
from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.notification.send_push")
def send_push(user_id: str, title: str, body: str, deep_link: str | None = None) -> int:
    """Send Expo push notification to all registered devices for a user."""
    return run_async(_send_async(UUID(user_id), title, body, deep_link))


async def _send_async(user_id: UUID, title: str, body: str, deep_link: str | None) -> int:
    async with session_scope() as session:
        tokens = await FcmService.tokens_for_user(session, user_id)
    if not tokens:
        logger.info("send_push skipped (no tokens)", user_id=str(user_id))
        return 0
    sent = FcmService.send(tokens=tokens, title=title, body=body, deep_link=deep_link)
    logger.info("send_push dispatched", user_id=str(user_id), sent=sent, total=len(tokens))
    return sent
