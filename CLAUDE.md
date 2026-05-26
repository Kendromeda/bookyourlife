# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Source of Truth

- Use `hasilkan-paket-dokumen-perencanaan-sunny-meerkat.md` as the source of truth for architecture, API contracts, DB schema, and phase order.
- Use `graphify-out/` as a repo map when exploring code relationships, especially before large or cross-module changes.
- FastAPI backend is the persisted-data source of truth. Frontend must follow backend schemas, not invent new persisted shapes.

## Hard Boundaries

- **Auth**: keep Clerk JWT verification through `app/deps.py`. Never hardcode tokens or bypass auth in production code.
- **API contracts**: before changing frontend payloads, read the matching backend endpoint, schema, and service. If payload shape changes, update backend code and tests in the same change.
- **Media/storage**: render public URLs in UI, but persist raw owned storage keys. Never weaken `assert_owned_storage_key`.
- **Heavy AI work**: OpenAI/Replicate work expected to take >2 seconds must run in Celery, not inside a FastAPI request handler.
- **Prompts**: LLM prompts must be Jinja2 templates in `backend/app/prompts/*.j2`.
- **Celery Beat**: do not create per-user schedules. Use `fan_out_*` tasks for dynamic user settings like `notif_hour`.
- **Migrations**: use Alembic autogenerate for normal schema changes, then review manually. Hand-edit pgvector extension/index migrations.
- **Push notifications**: send via Expo Push API through `FcmService.send()`. Register tokens via `POST /api/v1/users/me/fcm-token`.
- **Architecture**: keep heavy/business logic on the server. Do not move backend source-of-truth logic into Expo.
- **Language**: code identifiers stay English. User-facing strings stay English.

## Stop and Ask First

Ask before changing auth, storage ownership, migrations, payments/webhooks, Celery Beat, destructive delete behavior, or production security defaults.

## Verification

- Frontend API-call changes: run `npx tsc --noEmit` and `npm run lint`.
- Backend/API changes: run `cd backend; uv run pytest` and `cd backend; uv run ruff check .`.
- `cd backend; uv run mypy app` is non-blocking until the existing baseline is fixed.
- Final response must state backend files changed, API contracts affected, and checks run.
