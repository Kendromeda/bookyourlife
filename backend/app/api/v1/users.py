from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas.user import FcmTokenIn, UserOut, UserUpsertIn
from app.services.push.fcm import FcmService

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpsertIn, user: CurrentUser, session: SessionDep) -> UserOut:
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.face_photo_url is not None:
        user.face_photo_url = payload.face_photo_url
    if payload.notif_hour is not None:
        user.notif_hour = payload.notif_hour
    if payload.timezone is not None:
        user.timezone = payload.timezone
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)


@router.post("/me/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
async def register_fcm_token(
    payload: FcmTokenIn,
    user: CurrentUser,
    session: SessionDep,
) -> None:
    await FcmService.register_token(
        session,
        user_id=user.id,
        token=payload.token,
        platform=payload.platform,
    )
