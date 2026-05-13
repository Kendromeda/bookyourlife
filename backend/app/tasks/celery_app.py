from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

_settings = get_settings()

celery_app = Celery(
    "lifebook",
    broker=_settings.redis_url,
    backend=_settings.redis_url,
    include=[
        "app.tasks.question_gen",
        "app.tasks.index_entry",
        "app.tasks.book_gen",
        "app.tasks.image_gen",
        "app.tasks.notification",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Jakarta",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_max_tasks_per_child=200,
)

# Beat schedule untuk daily question generation per user batch.
# Phase 1: jalanin tiap jam, picker per-user logic ada di task itu sendiri
# (filter by `notif_hour`).
celery_app.conf.beat_schedule = {
    "fan-out-daily-questions": {
        "task": "app.tasks.question_gen.fan_out_daily_questions",
        "schedule": crontab(minute=30),  # tiap 30 menit lewat
    },
}
import app.tasks.image_gen  # noqa: F401
