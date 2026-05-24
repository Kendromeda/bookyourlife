from datetime import UTC, date, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.book import Book, GeneratedAsset
from app.models.entry import Entry
from app.models.user import User
from app.services.storage.r2 import get_r2_storage

logger = structlog.get_logger()


def _is_bucket_key(value: str | None) -> bool:
    return bool(value) and not value.startswith(  # type: ignore[union-attr]
        ("http://", "https://", "file://", "data:")
    )


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


def _user_tz(user: User) -> ZoneInfo | timezone:
    try:
        return ZoneInfo(user.timezone)
    except Exception:
        return UTC


async def get_user_stats(session: AsyncSession, *, user: User) -> dict[str, int]:
    """Compute lightweight stats for the Today screen progress bar.

    All "day" boundaries are computed in the user's local timezone so the
    streak/active-day math matches what the user sees in the UI.
    """
    tz = _user_tz(user)
    now_local = datetime.now(tz=tz)
    today_local = now_local.date()
    cutoff_30 = datetime.combine(
        today_local - timedelta(days=30),
        datetime.min.time(),
        tzinfo=tz,
    ).astimezone(UTC)

    # Pull all entries' written_at for the user (lightweight: one column).
    rows = await session.execute(
        select(Entry.written_at, func.length(Entry.body)).where(Entry.user_id == user.id)
    )
    items = list(rows.all())

    entries_last_30_days = 0
    total_words = 0
    total_entries = len(items)
    day_set: set[date] = set()

    for written_at, body_len in items:
        entry_written_at = written_at
        if entry_written_at.tzinfo is None:
            entry_written_at = entry_written_at.replace(tzinfo=UTC)
        local_day = entry_written_at.astimezone(tz).date()
        day_set.add(local_day)
        if entry_written_at.astimezone(UTC) >= cutoff_30:
            entries_last_30_days += 1
        # body_len is char length, not words; approximate words by /5 (avg English/Indonesian)
        # but a more honest signal: split on whitespace would require fetching body —
        # keep the cheap proxy and let the frontend label it "characters" if needed.
        # Since the planning doc lists words: rough proxy = chars / 5.
        if body_len:
            total_words += max(1, body_len // 5)

    # Current streak: count consecutive days ending today (or yesterday if no
    # entry today yet — we still want to keep the streak alive until the day
    # actually ends).
    streak = 0
    cursor = today_local
    if cursor in day_set:
        while cursor in day_set:
            streak += 1
            cursor = cursor - timedelta(days=1)
    else:
        # Allow grace: if user wrote yesterday but not yet today, streak counts up to yesterday.
        cursor = today_local - timedelta(days=1)
        while cursor in day_set:
            streak += 1
            cursor = cursor - timedelta(days=1)

    return {
        "entries_last_30_days": entries_last_30_days,
        "current_streak_days": streak,
        "total_entries": total_entries,
        "total_words": total_words,
    }


async def _collect_user_storage_keys(session: AsyncSession, user: User) -> list[str]:
    """Every R2 object key owned by the user (entry media, books, profile)."""
    keys: list[str] = []

    entries = (
        await session.execute(
            select(Entry)
            .where(Entry.user_id == user.id)
            .options(
                selectinload(Entry.photos),
                selectinload(Entry.videos),
                selectinload(Entry.audios),
            )
        )
    ).scalars().all()
    for entry in entries:
        keys.extend(p.storage_key for p in entry.photos)
        keys.extend(v.storage_key for v in entry.videos)
        keys.extend(a.storage_key for a in entry.audios)

    book_rows = await session.execute(
        select(Book.id, Book.pdf_r2_key, Book.cover_r2_key).where(Book.user_id == user.id)
    )
    book_ids: list[UUID] = []
    for book_id, pdf_key, cover_key in book_rows.all():
        book_ids.append(book_id)
        keys.extend(k for k in (pdf_key, cover_key) if k)

    if book_ids:
        asset_rows = await session.execute(
            select(GeneratedAsset.r2_key).where(GeneratedAsset.book_id.in_(book_ids))
        )
        keys.extend(k for (k,) in asset_rows.all() if k)

    keys.append(user.face_photo_url or "")
    return [k for k in keys if _is_bucket_key(k)]


async def delete_user(session: AsyncSession, *, user: User) -> None:
    """Delete the user and all their data, including R2 storage objects.

    DB rows cascade from the User delete; R2 objects have no DB FK so they
    must be collected first and deleted after the commit. A storage cleanup
    failure is logged but never blocks account deletion (objects can be swept
    later); the user's right to deletion takes precedence.
    """
    storage_keys = await _collect_user_storage_keys(session, user)
    user_id = user.id
    await session.execute(delete(User).where(User.id == user_id))
    await session.commit()

    if storage_keys:
        try:
            get_r2_storage().delete_objects(storage_keys)
        except Exception as exc:
            logger.warning(
                "user r2 cleanup failed",
                user_id=str(user_id),
                object_count=len(storage_keys),
                error=str(exc),
            )


async def export_user_data(session: AsyncSession, *, user_id: UUID) -> dict:
    """Return a JSON-serializable snapshot of the user's entries.

    Photos/videos/audios are emitted as raw storage keys (the export
    endpoint replaces them with public URLs for portability).
    """
    stmt = (
        select(Entry)
        .where(Entry.user_id == user_id)
        .options(
            selectinload(Entry.photos),
            selectinload(Entry.videos),
            selectinload(Entry.audios),
        )
        .order_by(Entry.written_at)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return {
        "exported_at": datetime.now(tz=UTC).isoformat(),
        "entries": [
            {
                "id": str(entry.id),
                "title": entry.title,
                "body": entry.body,
                "written_at": entry.written_at.isoformat() if entry.written_at else None,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "lat": entry.lat,
                "lng": entry.lng,
                "place_name": entry.place_name,
                "weather": entry.weather,
                "photos": [p.storage_key for p in (entry.photos or [])],
                "videos": [v.storage_key for v in (entry.videos or [])],
                "audios": [
                    {"storage_key": a.storage_key, "transcript": a.transcript}
                    for a in (entry.audios or [])
                ],
            }
            for entry in rows
        ],
    }
