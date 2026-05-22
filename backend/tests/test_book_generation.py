from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from typing import Any, cast
from uuid import uuid4

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.api.v1 import books as books_api
from app.db import get_session
from app.deps import get_current_user
from app.main import create_app
from app.models.book import Book, BookPlan
from app.models.entry import Entry
from app.models.user import User
from app.schemas.book import BookGenerateRequest
from app.tasks import book_pipeline
from app.tasks.book_pipeline import (
    _fallback_enhancement,
    _fallback_plan,
    _normalize_plan_payload,
)

QUOTE_SPOTLIGHT_TEMPLATE = 4


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, obj: object) -> None:
        if getattr(obj, "id", None) is None:
            cast(Any, obj).id = uuid4()
        self.added.append(obj)

    async def commit(self) -> None:
        return None

    async def refresh(self, _: object) -> None:
        return None


def test_book_generate_request_rejects_invalid_date_range() -> None:
    with pytest.raises(ValidationError):
        BookGenerateRequest(date_start=date(2026, 2, 1), date_end=date(2026, 1, 1))


def test_create_generated_book_sets_generation_flow_and_enqueues(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app = create_app()
    fake_session = FakeSession()
    user = User(id=uuid4(), clerk_id="user_123", preferred_language="en")
    enqueued: list[str] = []

    async def override_session():  # type: ignore[no-untyped-def]
        yield fake_session

    def override_user() -> User:
        return user

    def enqueue(book_id: str) -> None:
        enqueued.append(book_id)

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr(books_api, "_generation_worker_ready", lambda: (True, None))
    monkeypatch.setattr(books_api.generate_book_pipeline, "delay", enqueue)

    client = TestClient(app)
    response = client.post(
        "/api/v1/books/generate",
        json={
            "date_start": "2026-01-01",
            "date_end": "2026-03-31",
            "mode": "illustrated",
            "style_preset": "watercolor",
            "cover_mode": "ai_mood",
            "include_voice_transcripts": True,
            "illustrated_required": False,
        },
    )

    assert response.status_code == status.HTTP_202_ACCEPTED
    created = next(item for item in fake_session.added if isinstance(item, Book))
    assert created.config["flow"] == "generation"
    assert created.config["language"] == "en"
    assert created.status == "queued"
    assert created.progress == 1
    assert created.current_stage == "queued"
    assert enqueued == [str(created.id)]


def test_create_generated_book_rejects_when_worker_unavailable(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    app = create_app()
    fake_session = FakeSession()
    user = User(id=uuid4(), clerk_id="user_123", preferred_language="en")

    async def override_session():  # type: ignore[no-untyped-def]
        yield fake_session

    def override_user() -> User:
        return user

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr(
        books_api,
        "_generation_worker_ready",
        lambda: (False, "Book queue worker unavailable"),
    )

    client = TestClient(app)
    response = client.post(
        "/api/v1/books/generate",
        json={
            "date_start": "2026-01-01",
            "date_end": "2026-03-31",
            "mode": "illustrated",
            "style_preset": "watercolor",
            "cover_mode": "ai_mood",
            "include_voice_transcripts": True,
            "illustrated_required": False,
        },
    )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert not any(isinstance(item, Book) for item in fake_session.added)


def test_preview_filter_excludes_generation_flow() -> None:
    compiled_obj = books_api._preview_filter().compile(dialect=postgresql.dialect())
    compiled = str(compiled_obj)
    assert "coalesce" in compiled.lower()
    assert "generation" in compiled_obj.params.values()


def test_generation_serializer_uses_plan_and_local_pdf_url() -> None:
    book = Book(
        id=uuid4(),
        user_id=uuid4(),
        timeframe="custom",
        style="watercolor",
        status="completed",
        progress=100,
        pdf_url="file:///tmp/book.pdf",
        config={"flow": "generation"},
    )
    plan = BookPlan(
        book_id=book.id,
        generated_title="Quiet Pages",
        subtitle="January through March",
        theme_summary="A reflective season.",
        dominant_mood="reflective",
        chapter_strategy="monthly",
        plan={},
    )

    detail = books_api._serialize_generation(book, plan)

    assert detail.book_id == book.id
    assert detail.status == "completed"
    assert detail.generated_title == "Quiet Pages"
    assert detail.pdf_url == "file:///tmp/book.pdf"


def test_fallback_plan_assigns_all_entries() -> None:
    user_id = uuid4()
    book = Book(
        id=uuid4(),
        user_id=user_id,
        timeframe="custom",
        style="watercolor",
        period_start=datetime(2026, 1, 1, tzinfo=UTC),
        period_end=datetime(2026, 3, 1, tzinfo=UTC),
        status="queued",
        config={"flow": "generation"},
    )
    entries = [
        Entry(
            id=uuid4(),
            user_id=user_id,
            body=f"Entry number {index} with enough words to be included.",
            written_at=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(days=index),
            emotion_tags=[],
            photos=[],
            audios=[],
        )
        for index in range(20)
    ]

    plan = _fallback_plan(book, entries, "monthly", "en")
    planned_ids = {
        entry_id
        for chapter in plan["chapters"]
        for entry_id in chapter["entry_ids"]
    }

    assert planned_ids == {str(entry.id) for entry in entries}


def test_normalized_llm_plan_reassigns_sequential_chapter_positions() -> None:
    user_id = uuid4()
    entries = [
        Entry(
            id=uuid4(),
            user_id=user_id,
            body=f"Entry number {index} with enough words to be included.",
            written_at=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(days=index),
            emotion_tags=[],
            photos=[],
            audios=[],
        )
        for index in range(3)
    ]
    payload = {
        "book_title": "Odd Numbered Days",
        "theme_summary": "A short season.",
        "chapters": [
            {
                "position": 7,
                "title": "First",
                "entry_ids": [str(entries[0].id)],
            },
            {
                "position": 7,
                "title": "Second",
                "entry_ids": [str(entries[1].id)],
            },
        ],
    }

    plan = _normalize_plan_payload(payload, entries, "thematic")

    assert [chapter["position"] for chapter in plan["chapters"]] == [1, 2, 3]
    planned_ids = {
        entry_id
        for chapter in plan["chapters"]
        for entry_id in chapter["entry_ids"]
    }
    assert planned_ids == {str(entry.id) for entry in entries}


async def test_generation_plan_uses_local_fallback_unless_ai_enabled(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    def fail_if_called(*_: object, **__: object) -> dict:
        raise AssertionError("generation OpenAI should be disabled by default")

    monkeypatch.setattr(book_pipeline, "_generate_plan_with_llm", fail_if_called)
    monkeypatch.setattr(
        book_pipeline,
        "get_settings",
        lambda: SimpleNamespace(
            openai_api_key="sk-test",
            book_generation_ai_enabled=False,
        ),
    )
    user_id = uuid4()
    book = Book(
        id=uuid4(),
        user_id=user_id,
        timeframe="custom",
        style="watercolor",
        period_start=datetime(2026, 1, 1, tzinfo=UTC),
        period_end=datetime(2026, 1, 31, tzinfo=UTC),
        status="queued",
        config={"flow": "generation"},
    )
    entries = [
        Entry(
            id=uuid4(),
            user_id=user_id,
            body=f"Entry number {index} with enough words to be included.",
            written_at=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(days=index),
            emotion_tags=[],
            photos=[],
            audios=[],
        )
        for index in range(20)
    ]

    plan = await book_pipeline._llm_or_fallback_plan(book, entries, "thematic", "en")

    assert plan["book_title"] == "Life Book 2026"
    assert plan["chapters"]


def test_fallback_enhancement_chooses_diary_style_for_text_only_entry() -> None:
    book = Book(
        id=uuid4(),
        user_id=uuid4(),
        timeframe="custom",
        style="watercolor",
        status="queued",
        config={"include_voice_transcripts": False},
    )
    entry = Entry(
        id=uuid4(),
        user_id=book.user_id,
        body="This was a quiet day. I noticed how much I needed the silence around me.",
        written_at=datetime(2026, 1, 1, tzinfo=UTC),
        emotion_tags=[],
        photos=[],
        audios=[],
    )

    enhancement = _fallback_enhancement(book, entry)

    assert enhancement["layout_template"] == QUOTE_SPOTLIGHT_TEMPLATE
    assert enhancement["pull_quote"] == "This was a quiet day."


def test_generation_llm_client_uses_timeout_and_no_retries(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):  # type: ignore[no-untyped-def]
            captured["timeout"] = kwargs["timeout"]
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content=(
                                '{"book_title":"Fast Fallback Guard","theme_summary":"A season.",'
                                '"chapters":[{"position":1,"title":"Chapter 1","entry_ids":[]}]}'
                            )
                        )
                    )
                ]
            )

    class FakeOpenAI:
        def __init__(self, *, api_key: str, max_retries: int) -> None:
            captured["api_key"] = api_key
            captured["max_retries"] = max_retries
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(book_pipeline, "OpenAI", FakeOpenAI)
    monkeypatch.setattr(
        book_pipeline,
        "get_settings",
        lambda: SimpleNamespace(
            openai_api_key="sk-test",
            openai_model_narrative="gpt-test",
            book_generation_openai_timeout_seconds=7.5,
            book_generation_openai_max_retries=0,
        ),
    )
    user_id = uuid4()
    book = Book(
        id=uuid4(),
        user_id=user_id,
        timeframe="custom",
        style="watercolor",
        period_start=datetime(2026, 1, 1, tzinfo=UTC),
        period_end=datetime(2026, 1, 31, tzinfo=UTC),
        status="queued",
        config={"flow": "generation"},
    )

    book_pipeline._generate_plan_with_llm(book, [], "thematic", "en")

    assert captured == {
        "api_key": "sk-test",
        "max_retries": 0,
        "timeout": 7.5,
    }
