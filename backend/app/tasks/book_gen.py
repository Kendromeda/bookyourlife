import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.book_gen.generate_book")
def generate_book(book_id: str) -> None:
    """Phase 3.2: full pipeline (cluster -> chapter narrative -> covers -> PDF)."""
    logger.info("generate_book stub", book_id=book_id)
