"""Phase 1.6 — basic question generator: 10 entry terakhir + no-repeat constraint.

Phase 2 akan menambahkan RAG retrieval di atas ini.
"""
import random
from datetime import datetime
from pathlib import Path
from uuid import UUID

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.question import Question
from app.services import questions as q_service
from app.services.llm import OpenAIClient

_PROMPT_DIR = Path(__file__).parent.parent / "prompts"
_env = Environment(
    loader=FileSystemLoader(str(_PROMPT_DIR)),
    autoescape=select_autoescape(default=False),
    trim_blocks=True,
    lstrip_blocks=True,
)


async def generate_question_for_user(
    session: AsyncSession,
    *,
    user_id: UUID,
    llm: OpenAIClient | None = None,
) -> Question:
    settings = get_settings()
    llm = llm or OpenAIClient()

    recent_entries = await q_service.recent_entry_bodies(session, user_id=user_id, limit=10)
    recent_questions = await q_service.recent_question_texts(session, user_id=user_id, days=30)

    has_history = bool(recent_entries)
    mode = (
        "fresh"
        if not has_history or random.random() < 0.30  # noqa: S311 (non-crypto, distribusi 70/30)
        else "follow_up"
    )

    summary_lines = "\n".join(f"- {body[:300]}" for body in recent_entries[:10])
    today = datetime.now().strftime("%A %d %B %Y")
    prompt_user = _env.get_template("daily_question.j2").render(
        user_name="kamu",
        recent_summary=summary_lines or "(belum ada cerita)",
        top_themes="(belum dianalisis)",
        recent_questions=recent_questions[:30],
        mode=mode,
        today_label=today,
    )
    system_prompt = (
        "Kamu teman dekat user yang sudah mendengar cerita-ceritanya. "
        "Tone hangat, penasaran, tidak menghakimi. Bahasa Indonesia kasual, max 25 kata."
    )

    text = await llm.generate_text(
        system=system_prompt,
        user=prompt_user,
        model=settings.openai_model_question,
        max_tokens=80,
        temperature=0.85,
    )

    return await q_service.persist_question(
        session,
        user_id=user_id,
        text=text,
        source="follow_up" if mode == "follow_up" else "fresh",
        context_entry_ids=[],
    )
