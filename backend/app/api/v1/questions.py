from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import NoResultFound

from app.deps import CurrentUser, SessionDep
from app.schemas.question import QuestionOut
from app.services import questions as questions_service
from app.services.question_generator import generate_question_for_user

router = APIRouter()


@router.get("/today", response_model=QuestionOut)
async def todays_question(user: CurrentUser, session: SessionDep) -> QuestionOut:
    existing = await questions_service.latest_question_for_today(session, user_id=user.id)
    if existing is not None:
        return QuestionOut.model_validate(existing)

    # Belum ada — generate sync (max 5s) untuk Phase 1.
    # Phase 2: panggilan ke Celery + return 202 + push ketika ready.
    question = await generate_question_for_user(session, user_id=user.id)
    return QuestionOut.model_validate(question)


@router.post("/{question_id}/skip", status_code=status.HTTP_204_NO_CONTENT)
async def skip_question(question_id: UUID, user: CurrentUser, session: SessionDep) -> None:
    try:
        await questions_service.mark_skipped(session, user_id=user.id, question_id=question_id)
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found") from None
