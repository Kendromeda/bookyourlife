/ini# Life Book

Aplikasi mobile journaling AI: pertanyaan harian yang mengingat riwayat cerita, output buku narasi dengan ilustrasi AI personal, opsi cetak fisik.

Status: **Phase 0 — scaffolding selesai 2026-04-28**.

## Layout

- `android/` — Kotlin + Jetpack Compose, multi-module Clean Architecture (Hilt, Room, Retrofit, Firebase, RevenueCat)
- `backend/` — Python 3.12 + FastAPI + Celery + PostgreSQL 16 (pgvector) + Redis
- `docs/` — PRD dan dokumen perencanaan
- `.github/workflows/` — CI per stack

## Quickstart

### Android

Buka `android/` di Android Studio (Hedgehog atau lebih baru). Sebelum build pertama:

1. Salin `android/app/google-services.json.example` → `android/app/google-services.json` dan isi dengan service account dari Firebase project.
2. Sync Gradle.
3. Run `./gradlew :app:assembleDebug` untuk verifikasi.

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

- Plan eksekusi master: `~/.claude/plans/hasilkan-paket-dokumen-perencanaan-sunny-meerkat.md`
- PRD lengkap: `docs/prd.md` (perlu di-checkin)

## Stack ringkas

LLM: OpenAI (gpt-4o + text-embedding-3-small) · Image gen: GPT 2.0 · Auth+Push: Firebase · Storage: Cloudflare R2 · Subscription: RevenueCat · Print: Lulu Direct.

Bahasa primary: Inggris.
