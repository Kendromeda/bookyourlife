from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy.exc import NoResultFound

from app.deps import CurrentUser, SessionDep
from app.schemas.question import QuestionOut, QuestionPendingOut
from app.services import questions as questions_service
from app.tasks.question_gen import generate_for_user

router = APIRouter()


@router.get(
    "/today",
    response_model=QuestionOut | QuestionPendingOut,
    status_code=status.HTTP_200_OK,
    responses={status.HTTP_202_ACCEPTED: {"model": QuestionPendingOut}},
)
async def todays_question(
    user: CurrentUser,
    session: SessionDep,
    response: Response,
) -> QuestionOut | QuestionPendingOut:
    existing = await questions_service.latest_question_for_today(session, user_id=user.id)
    if existing is not None:
        return QuestionOut.model_validate(existing)

    generate_for_user.delay(str(user.id))
    response.status_code = status.HTTP_202_ACCEPTED
    return QuestionPendingOut()


@router.post("/{question_id}/skip", status_code=status.HTTP_204_NO_CONTENT)
async def skip_question(question_id: UUID, user: CurrentUser, session: SessionDep) -> None:
    try:
        await questions_service.mark_skipped(session, user_id=user.id, question_id=question_id)
    except NoResultFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found") from None
