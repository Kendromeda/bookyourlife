import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.index_entry.index_entry")
def index_entry(entry_id: str) -> None:
    """Phase 2.1: embed entry body and save it to entries.body_embedding."""
    logger.info("index_entry stub", entry_id=entry_id)
