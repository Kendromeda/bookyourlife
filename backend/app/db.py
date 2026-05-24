import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_settings = get_settings()
_engines: dict[tuple[int, int], AsyncEngine] = {}
_sessionmakers: dict[tuple[int, int], async_sessionmaker[AsyncSession]] = {}


def _loop_key() -> tuple[int, int]:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return (os.getpid(), 0)
    return (os.getpid(), id(loop))


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    key = _loop_key()
    if key not in _sessionmakers:
        engine = create_async_engine(_settings.database_url, echo=False, pool_pre_ping=True)
        _engines[key] = engine
        _sessionmakers[key] = async_sessionmaker(
            engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _sessionmakers[key]


async def get_session() -> AsyncIterator[AsyncSession]:
    async with _sessionmaker()() as session:
        yield session


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    async with _sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
