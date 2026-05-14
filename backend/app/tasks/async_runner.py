from __future__ import annotations

import asyncio
import os
from collections.abc import Coroutine
from typing import Any, TypeVar

T = TypeVar("T")


class _RunnerState:
    loop: asyncio.AbstractEventLoop | None = None
    pid: int | None = None


_state = _RunnerState()


def run_async(awaitable: Coroutine[Any, Any, T]) -> T:  # noqa: UP047
    """Run async DB code on one stable event loop per Celery worker process."""
    pid = os.getpid()
    if _state.loop is None or _state.loop.is_closed() or _state.pid != pid:
        _state.loop = asyncio.new_event_loop()
        _state.pid = pid
        asyncio.set_event_loop(_state.loop)

    return _state.loop.run_until_complete(awaitable)
