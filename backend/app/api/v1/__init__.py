from fastapi import APIRouter

from app.api.v1 import ai, entries, questions, uploads, users

router = APIRouter()
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(entries.router, prefix="/entries", tags=["entries"])
router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
router.include_router(questions.router, prefix="/questions", tags=["questions"])
router.include_router(ai.router, tags=["ai"])

# Phase 2:
# router.include_router(memories.router, prefix="/memories", tags=["memories"])
# Phase 3:
# router.include_router(books.router, prefix="/books", tags=["books"])
# router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
# Phase 4:
# router.include_router(orders.router, prefix="/orders", tags=["orders"])
