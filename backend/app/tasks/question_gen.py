"""Celery tasks untuk daily question fan-out + per-user generation.

Pattern: beat memicu fan_out_daily_questions tiap 30 menit. Task itu query
user yang `notif_hour` cocok dengan jam sekarang (zona waktu user) dan
enqueue per-user generate_for_user. JANGAN schedule per-user di beat — akan
meledak di scale.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import select

from app.db import session_scope
from app.models.user import User
from app.services.question_generator import generate_question_for_user
from app.tasks.celery_app import celery_app
from app.tasks.notification import send_push

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.question_gen.fan_out_daily_questions")
def fan_out_daily_questions() -> int:
    """Query user yang due dan enqueue per-user generation.

    "Due" = user.notif_hour == jam sekarang di timezone user. Untuk Phase 1
    sederhanakan: pakai UTC saja; tunable Phase 2.
    """
    return asyncio.run(_fan_out_async())


async def _fan_out_async() -> int:
    now = datetime.now(tz=UTC)
    async with session_scope() as session:
        stmt = select(User.id).where(User.notif_hour == now.hour)
        user_ids = list((await session.execute(stmt)).scalars().all())

    for uid in user_ids:
        generate_for_user.delay(str(uid))

    logger.info("fan_out_daily_questions enqueued", count=len(user_ids), hour=now.hour)
    return len(user_ids)


@celery_app.task(name="app.tasks.question_gen.generate_for_user")
def generate_for_user(user_id: str) -> str | None:
    return asyncio.run(_generate_for_user_async(UUID(user_id)))


async def _generate_for_user_async(user_id: UUID) -> str | None:
    async with session_scope() as session:
        question = await generate_question_for_user(session, user_id=user_id)

    send_push.delay(
        str(user_id),
        title="Pertanyaan hari ini",
        body=question.text,
        deep_link=f"lifebook://question/{question.id}",
    )
    logger.info("question generated", user_id=str(user_id), question_id=str(question.id))
    return str(question.id)
