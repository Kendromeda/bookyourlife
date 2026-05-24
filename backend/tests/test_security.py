from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.main import _resolve_cors_origins
from app.models.entry import Entry, EntryPhoto
from app.models.user import User
from app.services import users as users_service
from app.services.storage.ownership import (
    PURPOSE_ENTRY_PHOTO,
    PURPOSE_FACE_PHOTO,
    StorageKeyOwnershipError,
    assert_owned_storage_key,
)

# ── P0-1: storage-key ownership validation ──────────────────────────────


def test_assert_owned_storage_key_accepts_own_key() -> None:
    user_id = uuid4()
    key = f"entry-photo/{user_id}/photo.jpg"
    assert (
        assert_owned_storage_key(key, user_id, allowed_purposes=(PURPOSE_ENTRY_PHOTO,))
        == key
    )


def test_assert_owned_storage_key_rejects_foreign_key() -> None:
    other_id = uuid4()
    key = f"entry-photo/{other_id}/photo.jpg"
    with pytest.raises(StorageKeyOwnershipError):
        assert_owned_storage_key(key, uuid4(), allowed_purposes=(PURPOSE_ENTRY_PHOTO,))


def test_assert_owned_storage_key_rejects_wrong_purpose() -> None:
    user_id = uuid4()
    key = f"face-photo/{user_id}/me.jpg"
    with pytest.raises(StorageKeyOwnershipError):
        assert_owned_storage_key(key, user_id, allowed_purposes=(PURPOSE_ENTRY_PHOTO,))


def test_assert_owned_storage_key_http_passthrough_when_allowed() -> None:
    url = "https://legacy.example/me.jpg"
    assert (
        assert_owned_storage_key(
            url, uuid4(), allowed_purposes=(PURPOSE_FACE_PHOTO,), allow_http_passthrough=True
        )
        == url
    )


def test_assert_owned_storage_key_http_rejected_without_passthrough() -> None:
    with pytest.raises(StorageKeyOwnershipError):
        assert_owned_storage_key(
            "https://legacy.example/me.jpg",
            uuid4(),
            allowed_purposes=(PURPOSE_FACE_PHOTO,),
        )


# ── P0-4: CORS fail-safe ────────────────────────────────────────────────


def test_cors_wildcard_rejected_in_production() -> None:
    settings = SimpleNamespace(environment="production", cors_origins=["*"])
    with pytest.raises(RuntimeError):
        _resolve_cors_origins(settings)  # type: ignore[arg-type]


def test_cors_explicit_origins_allowed_in_production() -> None:
    origins = ["https://app.example.com"]
    settings = SimpleNamespace(environment="production", cors_origins=origins)
    assert _resolve_cors_origins(settings) == origins  # type: ignore[arg-type]


def test_cors_wildcard_allowed_outside_production() -> None:
    settings = SimpleNamespace(environment="local", cors_origins=["*"])
    assert _resolve_cors_origins(settings) == ["*"]  # type: ignore[arg-type]


# ── P1-2: delete account purges R2 objects ──────────────────────────────


class _FakeResult:
    def __init__(self, rows: list) -> None:
        self._rows = rows

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list:
        return self._rows


class _FakeDeleteSession:
    """Returns canned results for the queries in _collect_user_storage_keys,
    in order: entries, book columns, generated assets. Later calls (the
    User DELETE) get an empty result."""

    def __init__(self, results: list[_FakeResult]) -> None:
        self._results = list(results)

    async def execute(self, *_args: object, **_kwargs: object) -> _FakeResult:
        return self._results.pop(0) if self._results else _FakeResult([])

    async def commit(self) -> None:
        return None


@pytest.mark.asyncio
async def test_delete_user_purges_all_user_r2_objects(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    user_id = uuid4()
    book_id = uuid4()
    user = User(
        id=user_id,
        clerk_id="user_123",
        face_photo_url=f"face-photo/{user_id}/me.jpg",
    )
    entry = Entry(
        id=uuid4(),
        user_id=user_id,
        body="hello",
        written_at=datetime(2026, 1, 1, tzinfo=UTC),
        emotion_tags=[],
        photos=[
            EntryPhoto(storage_key=f"entry-photo/{user_id}/p.jpg", position=0),
            # legacy absolute URL — must be filtered out (not a bucket key)
            EntryPhoto(storage_key="https://legacy.example/old.jpg", position=1),
        ],
        videos=[],
        audios=[],
    )
    session = _FakeDeleteSession(
        [
            _FakeResult([entry]),
            _FakeResult([(book_id, f"book-pdf/{user_id}/b.pdf", None)]),
            _FakeResult([(f"book-assets/{user_id}/cover.png",)]),
        ]
    )

    deleted: list[list[str]] = []
    fake_storage = SimpleNamespace(delete_objects=deleted.append)
    monkeypatch.setattr(users_service, "get_r2_storage", lambda: fake_storage)

    await users_service.delete_user(session, user=user)  # type: ignore[arg-type]

    assert len(deleted) == 1
    assert set(deleted[0]) == {
        f"entry-photo/{user_id}/p.jpg",
        f"book-pdf/{user_id}/b.pdf",
        f"book-assets/{user_id}/cover.png",
        f"face-photo/{user_id}/me.jpg",
    }
    assert "https://legacy.example/old.jpg" not in deleted[0]
