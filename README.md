# Life Book

Aplikasi mobile journaling AI: pertanyaan harian yang mengingat riwayat cerita, output buku narasi dengan ilustrasi AI personal, opsi cetak fisik.

## Layout

- `app/` — Expo Router screens (auth flow, tabs, book viewer)
- `components/`, `hooks/`, `utils/`, `stores/`, `constants/` — RN UI, hooks, API client, Zustand stores, theme
- `backend/` — Python 3.12 + FastAPI + Celery + PostgreSQL 16 (pgvector) + Redis
- `.github/workflows/` — CI per stack (Expo lint/typecheck, backend ruff/mypy/pytest)

## Quickstart

### Mobile (Expo / React Native)

```bash
npm install
npx expo start                   # press a (Android), i (iOS), w (web)
```

Configure environment (no secrets are committed):

- `EXPO_PUBLIC_API_BASE_URL` — backend base URL (use `https://…` for non-local; dev defaults to the Android emulator host `http://10.0.2.2:8000`)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key

### Backend

```bash
cd backend
cp .env.example .env             # isi credentials saat siap
docker compose up postgres redis # tunggu sampai healthy
docker compose run --rm api alembic upgrade head
docker compose up                # api di :8000, worker, beat
curl localhost:8000/healthz
```

Book PDF generation uses Playwright Chromium in the Celery worker. For local
non-Docker runs, install the browser once from `backend/`:

```bash
python -m playwright install chromium
```

## Dokumen

- Plan eksekusi master: `hasilkan-paket-dokumen-perencanaan-sunny-meerkat.md`
- PRD lengkap: `docs/prd.md` (perlu di-checkin)

## Stack ringkas

Mobile: Expo + React Native + TypeScript (expo-router, Zustand, TanStack Query) · LLM: OpenAI (gpt-4o + text-embedding-3-small) · Image gen: OpenAI GPT Image · Auth: Clerk · Push: Expo Push API · Storage: Cloudflare R2 · Subscription: RevenueCat · Print: Lulu Direct.

Bahasa primary: Inggris.
