from fastapi import APIRouter, status

from app.deps import CurrentUser, SessionDep
from app.schemas.user import FcmTokenIn, UserOut, UserStatsOut, UserUpsertIn
from app.services import users as users_service
from app.services.push.fcm import FcmService
from app.services.storage.r2 import get_r2_storage

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
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.birthday is not None:
        user.birthday = payload.birthday
    if payload.journaling_goal is not None:
        user.journaling_goal = payload.journaling_goal
    await session.commit()
    await session.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user: CurrentUser, session: SessionDep) -> None:
    """Permanently delete the authenticated user and cascade their data."""
    await users_service.delete_user(session, user=user)


@router.get("/me/stats", response_model=UserStatsOut)
async def my_stats(user: CurrentUser, session: SessionDep) -> UserStatsOut:
    data = await users_service.get_user_stats(session, user=user)
    return UserStatsOut(**data)


@router.get("/me/export")
async def export_my_data(user: CurrentUser, session: SessionDep) -> dict:
    """JSON dump of the user's entries with media URLs rewritten to public R2 URLs."""
    snapshot = await users_service.export_user_data(session, user_id=user.id)
    storage = get_r2_storage()
    for entry in snapshot["entries"]:
        entry["photos"] = [storage.public_url(k) for k in entry["photos"]]
        entry["videos"] = [storage.public_url(k) for k in entry["videos"]]
        entry["audios"] = [
            {**a, "storage_key": storage.public_url(a["storage_key"])}
            for a in entry["audios"]
        ]
    return snapshot


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
