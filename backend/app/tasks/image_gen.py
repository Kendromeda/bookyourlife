import structlog

from app.tasks.celery_app import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.image_gen.generate_chapter_cover")
def generate_chapter_cover(chapter_id: str) -> str | None:
    """Phase 3.5: Replicate Flux 1.1 pro dengan face_ref konsistensi. Return R2 URL."""
    logger.info("generate_chapter_cover stub", chapter_id=chapter_id)
    return None
