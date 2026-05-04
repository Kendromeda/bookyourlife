from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_or_create_user(
    session: AsyncSession,
    *,
    clerk_id: str,
    email: str | None = None,
    display_name: str | None = None,
) -> User:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(clerk_id=clerk_id, email=email, display_name=display_name)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
