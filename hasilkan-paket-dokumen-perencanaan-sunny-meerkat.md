# Life Book — Paket Dokumen Perencanaan Eksekusi

**Tanggal:** 2026-04-28
**Status:** Ready for execution
**Berdasarkan:** PRD v1.0 (Andrea, 2026-04-27)

---

## 1. Context

PRD "Life Book" mendefinisikan aplikasi mobile journaling AI yang membimbing user lewat pertanyaan harian personal (LLM dengan memori RAG terhadap riwayat entry user) dan menghasilkan output buku narasi dengan ilustrasi AI yang dapat dicetak fisik. Proyek ini awalnya direncanakan sebagai native Android, namun telah bermigrasi menggunakan framework **Expo (React Native)** untuk pengembangan cross-platform.

**Mengapa rencana ini dibuat sekarang:**
- Scaffold proyek kini telah menggunakan framework Expo React Native (TypeScript) di root direktori.
- PRD memiliki Open Question kritis (Q1 LLM, Q2 vendor cetak, Q3 style ilustrasi, Q4 pricing) yang harus dijawab agar Phase 1 bisa mulai. Q1 sudah ditutup dalam dokumen ini (OpenAI). Q2-Q4 didelegasikan ke phase yang relevan dengan deadline jelas.
- PRD memberikan 24 task & ~268 jam tetapi dalam terminologi platform-agnostic. Eksekusi nyata membutuhkan: pemetaan task → komponen Expo & service Python, daftar dependency npm/pip konkret, skema DB, dan kontrak API.

**Outcome dokumen ini:** Engineer dapat membuka file ini, menginstal dependencies Expo, dan mulai mengeksekusi Phase 1 task-per-task tanpa harus membuat keputusan arsitektur lagi.

---

## 2. Stack Decisions (LOCKED)

| Layer               | Pilihan                                                                   | Rasional                                                          |
| ------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Mobile platform     | **Expo / React Native (TypeScript)**                                      | Tetap cross-platform iOS & Android dari satu codebase             |
| Min/target SDK      | **Expo SDK 50+**                                                          | Tetap modern + Expo Go compatible                                 |
| Mobile architecture | **React Hooks + Context / Zustand**                                       | State modular, ringan, scalable                                   |
| Local DB            | **expo-sqlite / AsyncStorage**                                            | Offline-first draft journaling (REQ-002)                          |
| Networking          | **Axios / Fetch + React Query**                                           | API sync + caching                                                |
| Routing             | **Expo Router**                                                           | File-based navigation                                             |
| UI/Design System    | **StyleSheet / Tailwind (NativeWind)**                                    | RN styling standard                                               |
| Auth                | **Clerk Expo (`@clerk/clerk-expo`)**                                      | Expo Go friendly, social login, JWT auth, no native Firebase lock |
| Session Storage     | **expo-secure-store**                                                     | Secure Clerk token/session persistence                            |
| Backend framework   | **Python 3.12 + FastAPI**                                                 | Async native, AI ecosystem matang                                 |
| Backend DB          | **Supabase PostgreSQL 16 + pgvector**                                     | Managed Postgres + vector memory + SQL-native                     |
| DB Access Layer     | **SQLAlchemy + Supabase connection string**                               | FastAPI tetap source of truth                                     |
| Backend queue       | **Celery + Redis**                                                        | Async jobs: question gen, book gen, image gen                     |
| LLM                 | **OpenAI** — `gpt-4o` (daily/question) + `gpt-4o` / `o1` (book narrative) | Service wrapper swappable                                         |
| Image generation    | **Flux 1.1 Pro via Replicate API**                                        | Face consistency                                                  |
| Push notification   | **Expo Notifications (Phase 1)** → optional FCM direct later              | Expo Go compatible, simpler MVP                                   |
| Object storage      | **Cloudflare R2**                                                         | Foto + PDF murah                                                  |
| Subscription        | **RevenueCat**                                                            | App store subscription abstraction                                |
| Print vendor        | **Lulu Direct API**                                                       | Hardcover/paperback                                               |
| Crash & analytics   | **Sentry + PostHog / GA4**                                                | Firebase dependency dikurangi                                     |
| CI/CD               | **GitHub Actions**                                                        | Expo lint/build + backend CI                                      |
| Deployment          | **DigitalOcean Droplet + Docker Compose**                                 | FastAPI + Redis + Celery self-host                                |


**Bahasa default UI:** Bahasa Inggris (Identifier kode juga dalam bahasa Inggris).

---

## 3. High-Level Architecture

┌──────────────────────────┐       HTTPS / JSON        ┌────────────────────────────┐
│ Expo App (Expo Go)      │ ───────────────────────▶ │ FastAPI (api.lifebook)     │
│ React Native + TS       │ ◀─────────────────────── │ REST API + Pydantic        │
│ - Expo Router           │   Clerk JWT Bearer Token │ Clerk JWT verification      │
│ - Zustand               │                          │ SQLAlchemy + Business Logic │
│ - React Query           │                          └─────────────┬──────────────┘
│ - expo-sqlite           │                                        │
│ - Clerk Expo SDK        │                                        ▼
│ - Expo Notifications    │                              ┌─────────────────────┐
└─────────────┬───────────┘                              │ Supabase Postgres   │
              │                                          │ PostgreSQL 16       │
              │ Push                                     │ pgvector            │
              ▼                                          └─────────┬───────────┘
      ┌─────────────────┐                                          │
      │ Expo Push / FCM │ ◀── Daily prompts / reminders ───────────┘
      └─────────────────┘
                                                                  │
                                                       ┌──────────┴──────────┐
                                                       ▼                     ▼
                                               ┌──────────────┐      ┌───────────────┐
                                               │ Celery Worker │      │ Redis Broker   │
                                               │ book/image    │      │ queue/cache    │
                                               └──────┬───────┘      └───────────────┘
                                                      │
                                   ┌──────────────────┴───────────────────┐
                                   ▼                                      ▼
                           ┌──────────────┐                      ┌────────────────┐
                           │ OpenAI GPT   │                      │ Replicate Flux │
                           └──────────────┘                      └────────────────┘
                                                      │
                                                      ▼
                                             ┌─────────────────┐
                                             │ Cloudflare R2   │
                                             │ photos / PDFs   │
                                             └─────────────────┘
```txt
```

***Sync model:**  
Mobile = UI state + offline draft  
FastAPI = source of truth  
Supabase Postgres = primary data store  
Conflict resolution = last-write-wins

---

## 4. Repository Layout (REVISED)

```txt
Book-Your-Life-app/
├── app/
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/
│   │   ├── index.tsx
│   │   ├── journal.tsx
│   │   ├── books.tsx
│   │   └── settings.tsx
│   ├── _layout.tsx
│   └── index.tsx
│
├── components/
│   ├── ui/
│   └── feature/
│
├── hooks/
│   ├── useAuth.ts
│   ├── useEntries.ts
│   └── useQuestions.ts
│
├── constants/
│   └── theme.ts
│
├── utils/
│   ├── api.ts                 # Axios + Clerk token interceptor
│   ├── db.ts                  # SQLite offline drafts
│   ├── clerk.ts               # Clerk config
│   ├── supabase.ts            # Supabase public client (optional)
│   ├── notifications.ts       # Expo notifications
│   └── queryClient.ts
│
├── assets/
│
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── deps.py            # Clerk JWT + DB + Redis deps
│   │   ├── api/v1/
│   │   │   ├── auth.py        # Clerk webhook / user sync
│   │   │   ├── entries.py
│   │   │   ├── questions.py
│   │   │   ├── books.py
│   │   │   ├── memories.py
│   │   │   ├── orders.py
│   │   │   └── webhooks.py    # RevenueCat + Lulu + Clerk
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── auth/          # Clerk token verification
│   │   │   ├── llm/
│   │   │   ├── imagegen/
│   │   │   ├── memory/
│   │   │   ├── storage/
│   │   │   ├── push/
│   │   │   └── print/
│   │   ├── tasks/
│   │   │   ├── celery_app.py
│   │   │   ├── question_gen.py
│   │   │   ├── book_gen.py
│   │   │   ├── image_gen.py
│   │   │   └── notification.py
│   │   └── prompts/
│   ├── alembic/
│   ├── tests/
│   └── docker-compose.yml
│
├── package.json
├── tsconfig.json
├── app.json
├── .env.example
├── .github/workflows/
│   ├── expo-ci.yml
│   └── backend-ci.yml
└── README.md

**Catatan migrasi:** Scaffold sekarang adalah framework Expo di `Book-Your-Life-app/`. Namespace package Android/iOS diatur di `app.json`.

---

## 5. Initial Expo Scaffolding (Phase 0, ~8h)

### 5.1 Step-by-step bootstrap

1. **Project init** (1h): Jalankan `create-expo-app` dengan template blank atau default di `Book-Your-Life-app/`.
2. **Setup Dependencies** (2h): Install dependencies penting:
   ```bash
   npm install @react-navigation/native expo-router axios zustand expo-sqlite nativewind react-native-reanimated
   npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/messaging
   ```
3. **Folder Structure** (2h): Buat folder struktur sesuai arsitektur (`app/`, `components/`, `hooks/`, `utils/`, `constants/`).
4. **Theme & DesignSystem** (1h): Setup `constants/Colors.ts` dan konfigurasi NativeWind (Tailwind CSS) dengan palet warna hangat (cream `#FAF6F0`, ink `#2C2421`, accent `#C4886B`).
5. **Navigation skeleton** (2h): Buat file dummy di `app/(tabs)/index.tsx`, `app/(tabs)/journal.tsx`, `app/(auth)/login.tsx` untuk memastikan expo-router bekerja.

### 5.2 Verifikasi Phase 0

- `npx expo start` sukses dan jalan di emulator / Expo Go
- App boot menampilkan splash → tab bar kosong tanpa crash
- Routing berfungsi antar tab

---

## 6. Initial Backend Scaffolding (Phase 0, ~10h)

### 6.1 Step-by-step bootstrap

1. **Project init** (1h): `cd backend && uv init`. `pyproject.toml`:
   ```toml
   [project]
   dependencies = [
     "fastapi[standard]>=0.115",
     "sqlalchemy[asyncio]>=2.0",
     "asyncpg>=0.30",
     "alembic>=1.14",
     "pydantic-settings>=2.6",
     "pgvector>=0.3",
     "celery[redis]>=5.4",
     "redis>=5.2",
     "firebase-admin>=6.5",
     "openai>=1.54",
     "replicate>=1.0",
     "boto3>=1.35",         # R2 (S3-compatible)
     "httpx>=0.27",
     "jinja2>=3.1",         # prompt templates
     "tenacity>=9.0",       # retry policy
     "structlog>=24.4",
   ]
   ```
2. **Settings** (1h): `app/config.py` pakai `pydantic_settings.BaseSettings`. Field: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `FIREBASE_CREDENTIALS_JSON`, `R2_*`, `LULU_*`, `REVENUECAT_WEBHOOK_SECRET`. `.env.example` di-commit.
3. **Database init** (2h): SQLAlchemy 2.0 async engine. `alembic init`. Initial migration: tabel `users`, `entries`, `entry_photos`, `questions`, `books`, `chapters`, `orders`. pgvector extension via `op.execute("CREATE EXTENSION IF NOT EXISTS vector")`.
4. **Auth dependency** (2h): `app/deps.py::get_current_user` verifikasi Firebase ID token via `firebase_admin.auth.verify_id_token`, return `User` ORM atau 401.
5. **Celery app** (1h): `app/tasks/celery_app.py` dengan Redis broker. Beat schedule untuk daily question generation per user (cron 06:00 default, override via user setting).
6. **Health & v1 endpoints stub** (1h): `GET /healthz`, `GET /api/v1/me` (return Firebase user info).
7. **docker-compose** (1h): postgres 16 dengan pgvector image, redis 7, dan service `worker` + `api` + `beat`. Mount `./backend:/app`.
8. **CI** (1h): GH Actions matrix Python 3.12 → `ruff check`, `mypy`, `pytest`.

### 6.2 Verifikasi Phase 0

- `docker compose up` semua service hijau
- `curl localhost:8000/healthz` → 200
- `alembic upgrade head` sukses, schema lengkap
- `pytest tests/test_health.py` hijau

---

## 7. Data Model (PostgreSQL)

```
users
  id UUID PK
  firebase_uid TEXT UNIQUE NOT NULL
  display_name TEXT
  email TEXT
  face_photo_url TEXT NULL          -- R2 key, optional
  notif_hour INT DEFAULT 9
  timezone TEXT DEFAULT 'Asia/Jakarta'
  subscription_tier TEXT DEFAULT 'free'  -- free | premium
  created_at, updated_at

entries
  id UUID PK
  user_id UUID FK → users
  question_id UUID NULL FK → questions  -- null jika user tulis bebas
  body TEXT
  body_embedding vector(1536) NULL      -- text-embedding-3-small, populated async
  emotion_tags TEXT[] DEFAULT '{}'      -- diisi saat indexing (REQ-003 retrieval)
  written_at TIMESTAMPTZ                -- user perceived date (≠ created_at)
  created_at, updated_at
  INDEX (user_id, written_at DESC)
  INDEX USING ivfflat (body_embedding vector_cosine_ops)

entry_photos
  id UUID PK
  entry_id UUID FK → entries ON DELETE CASCADE
  storage_key TEXT          -- R2 path
  position INT              -- urutan dalam entry, max 5
  created_at

questions
  id UUID PK
  user_id UUID FK
  text TEXT
  source TEXT               -- 'follow_up' | 'fresh' | 'on_this_date'
  context_entry_ids UUID[]  -- entry yang dipakai LLM untuk gen
  asked_at TIMESTAMPTZ
  answered_entry_id UUID NULL
  INDEX (user_id, asked_at DESC)

books
  id UUID PK
  user_id UUID FK
  timeframe TEXT            -- '3m' | '6m' | 'lifetime'
  style TEXT                -- 'poetic' | 'casual' | 'reflective'
  status TEXT               -- 'queued' | 'generating' | 'ready' | 'failed'
  pdf_url TEXT NULL
  generated_at TIMESTAMPTZ NULL
  created_at

chapters
  id UUID PK
  book_id UUID FK ON DELETE CASCADE
  position INT
  title TEXT
  narrative TEXT
  cover_image_url TEXT NULL
  source_entry_ids UUID[]

orders
  id UUID PK
  user_id UUID FK
  book_id UUID FK
  format TEXT               -- 'hardcover' | 'paperback'
  shipping_address JSONB
  lulu_order_id TEXT
  status TEXT               -- 'pending' | 'printing' | 'shipped' | 'delivered' | 'failed'
  amount_cents INT
  created_at, updated_at
```

**Embedding model:** `text-embedding-3-small` (1536 dim, $0.02 / 1M token). Dipopulasi async setelah entry tersimpan (Celery task `index_entry`).

---

## 8. Kontrak API (v1)

| Method | Path | Purpose | Phase |
|---|---|---|---|
| `POST` | `/api/v1/users/me` | upsert profil + face photo URL | 1 |
| `GET` | `/api/v1/users/me` | fetch profil | 1 |
| `POST` | `/api/v1/entries` | create entry (body + photo keys + question_id) | 1 |
| `GET` | `/api/v1/entries?cursor=…&limit=20` | list timeline | 1 |
| `PATCH` | `/api/v1/entries/{id}` | edit body (24h window) | 1 |
| `DELETE` | `/api/v1/entries/{id}` | hard delete | 1 |
| `POST` | `/api/v1/uploads/photo` | request presigned R2 PUT URL | 1 |
| `GET` | `/api/v1/questions/today` | fetch (or trigger gen) pertanyaan hari ini | 1→2 |
| `POST` | `/api/v1/questions/{id}/skip` | tandai skipped | 1 |
| `GET` | `/api/v1/memories/on-this-date` | feature REQ-004 | 2 |
| `POST` | `/api/v1/memories/{entry_id}/reply` | create entry yang me-link kenangan lama | 2 |
| `POST` | `/api/v1/books` | enqueue book generation (timeframe + style) | 3 |
| `GET` | `/api/v1/books` | list buku user | 3 |
| `GET` | `/api/v1/books/{id}` | detail buku + chapter list (long-poll/SSE untuk status) | 3 |
| `POST` | `/api/v1/books/{id}/chapters/{cid}/regenerate-cover` | rate-limited, REQ-006 | 3 |
| `POST` | `/api/v1/orders` | create print order | 4 |
| `GET` | `/api/v1/orders/{id}` | tracking status | 4 |
| `POST` | `/api/v1/webhooks/revenuecat` | subscription state | 3 |
| `POST` | `/api/v1/webhooks/lulu` | print status | 4 |

Auth: Firebase ID token di `Authorization: Bearer <token>` untuk semua kecuali webhook.

---

## 9. Desain Integrasi AI

### 9.1 Daily Question Generation (REQ-003)

**Trigger:** Celery beat per user, 30 menit sebelum `notif_hour` user.

**Pipeline:**
1. Ambil 10 entry terbaru user + 5 entry top-similarity ke "current life themes" (embedding query dari ringkasan 30 hari terakhir).
2. Ambil daftar 30 pertanyaan terakhir (no-repeat constraint).
3. Roll dadu 70/30: follow-up vs fresh.
4. Render prompt dari template `prompts/daily_question.j2`:
   - System: "Kamu teman dekat user, sudah mendengar cerita mereka. Tone: hangat, penasaran, tidak menghakimi."
   - Context: ringkasan entry + tanggal/cuaca/musim (untuk fresh)
   - Constraint: max 25 kata, bahasa Indonesia kasual, hindari kata yang sudah dipakai di 30 pertanyaan terakhir
5. Call OpenAI `gpt-4o`, temperature 0.8, max_tokens 80.
6. Simpan ke `questions`, kirim FCM dengan deep link `lifebook://question/{id}`.

**Cost target:** < $0.005 per user per hari.

### 9.2 RAG Memory Engine (Phase 2)

- Embedding: `text-embedding-3-small` saat entry dibuat (Celery `index_entry`).
- Retrieval: pgvector `ORDER BY body_embedding <=> :query_embedding LIMIT 5`.
- Re-ranking: optional GPT-4o-mini panggilan untuk pilih 3 paling relevan berdasarkan tema.

### 9.3 Book Narrative Generation (REQ-005)

**Pipeline (Celery `generate_book`):**
1. Fetch semua entry dalam timeframe.
2. **Cluster ke bab** via 2-stage:
   - Stage A: GPT-4o ringkas tiap entry jadi 1 kalimat tema.
   - Stage B: GPT-4o group ringkasan jadi 5–10 cluster bab dengan judul bab + entry IDs.
3. Per bab: GPT-4o (atau o1 untuk style "Reflektif") dengan template `prompts/chapter_{style}.j2`:
   - Input: entry mentah dalam urutan kronologis
   - Output: narasi 800–1500 kata dalam style yang dipilih
4. Generate cover (Section 9.4) per bab paralel.
5. Render PDF (WeasyPrint atau Playwright + HTML template) → upload R2 → set `books.status = 'ready'`.
6. Push notification "Bukumu siap dibaca".

**SLA:** ≤ 2 menit untuk 6 bulan entry (~180 entry, 8 bab).

### 9.4 Image Generation — Cover Bab (REQ-006)

**Tantangan:** Konsistensi karakter (PRD risk: "high"). Strategi:
- Saat user upload foto wajah: jalankan task `prepare_face_reference` → resize ke 512×512, upload ke R2, simpan URL.
- Per bab: Flux 1.1 pro via Replicate dengan input image (face ref) + prompt scene.
- Style locked (Q3): default **watercolor warm-tone** sampai user testing memutuskan.
- Prompt template: `"watercolor illustration, [character described from face], [scene from chapter theme], soft warm light, intimate atmosphere, --no text"`.
- Rate limit regenerate: 5x per bab per bulan, simpan counter di Redis.

**Fallback** (jika tidak upload foto): Flux generic prompt "silhouette of a person, [scene], watercolor".

---

## 10. Phase Execution Plan

Mapping PRD task → modul konkret. Estimasi mengikuti PRD.

### Phase 0 — Scaffolding (Minggu 0, ~22h, NEW)
| # | Task | Output | Est |
|---|---|---|---|
| 0.1 | Restructure repo + module skeleton (Section 5) | Compile-able multi-module Android | 9h |
| 0.2 | Convention plugins + version catalog | DRY build config | 3h |
| 0.3 | Backend FastAPI + Celery + Postgres bootstrap (Section 6) | `docker compose up` working | 8h |
| 0.4 | CI pipelines | PR build + test green | 2h |

### Phase 1 — Foundation MVP (Minggu 1–6, ~78h, sesuai PRD)
| # | PRD Task | Komponen Expo | Service Backend |
|---|---|---|---|
| 1.1 | Project setup + CI/CD | covered di Phase 0 | covered di Phase 0 |
| 1.2 | Auth (email + Google + Apple) | `app/(auth)`, Zustand Auth Store | `auth.py` middleware |
| 1.3 | Onboarding UI | `app/(auth)/onboarding.tsx` | `POST /users/me` |
| 1.4 | Entry input (text + foto) | `app/(tabs)/journal.tsx`, `components/feature/EntryEditor` | `POST /entries`, `POST /uploads/photo` |
| 1.5 | DB schema + entry CRUD | `utils/db.ts` (expo-sqlite) | `entries.py`, migrations |
| 1.6 | AI question gen (basic, no memory) | Fetch + React Query | `services/llm/openai.py`, `tasks/question_gen.py` |
| 1.7 | Push notification (FCM) | `utils/notifications.ts` | `services/push/fcm.py` |
| 1.8 | Home screen + entry list | `app/(tabs)/index.tsx`, `components/feature/Timeline` | `GET /entries` |

**Phase 1 verifikasi (Checkpoint 1):** 10 beta user pakai 1 minggu, onboarding < 3 menit, entry tersimpan, daily question terkirim.

### Phase 2 — AI Memory & Personalization (Minggu 7–10, ~57h)
| # | PRD Task | Output |
|---|---|---|
| 2.1 | Vector indexing | `tasks/index_entry.py`, pgvector setup |
| 2.2 | RAG retrieval engine | `services/memory/retrieval.py` |
| 2.3 | Upgrade question gen w/ memory | swap prompt template, A/B di-flag |
| 2.4 | "On This Date" | `services/memory/on_this_date.py`, `components/feature/MemoryCard` |
| 2.5 | Notification time customization | `app/(tabs)/settings.tsx`, `PATCH /users/me` |

**Phase 2 verifikasi:** 70% pertanyaan terasa follow-up (qualitative review 50 sample), beta D7 retention > 50%.

### Phase 3 — Book Generation & Ilustrasi (Minggu 11–16, ~75h)
| # | PRD Task | Output |
|---|---|---|
| 3.1 | RevenueCat + paywall | `utils/revenuecat.ts`, `app/paywall.tsx` |
| 3.2 | LLM book narrative pipeline | `tasks/book_gen.py`, prompts/chapter_*.j2 |
| 3.3 | Auto-chapter structuring | `services/llm/clustering.py` |
| 3.4 | Book preview UI | `app/(tabs)/books.tsx` (Expo Webview atau Native Pager) |
| 3.5 | Image gen integration | `services/imagegen/replicate.py`, `tasks/image_gen.py` |
| 3.6 | Face consistency engineering | `services/imagegen/face_ref.py`, prompts |

**Phase 3 verifikasi (Checkpoint 3):** Book dari 3 bulan entry < 2 menit. 5+ beta bilang mau bayar.

### Phase 4 — Print & Polish (Minggu 17–20, ~58h)
| # | PRD Task | Output |
|---|---|---|
| 4.1 | PDF export | WeasyPrint template + R2 upload |
| 4.2 | Lulu Direct integration | `services/print/lulu.py` |
| 4.3 | Order flow UI | `app/order.tsx`, payment via RC or Stripe |
| 4.4 | UX polish + bugs | cross-cutting |
| 4.5 | Performance + load testing | locust untuk backend, React Profiler |

### Phase 5 — Launch (Minggu 21–22)
- Internal testing track Play Console
- Soft launch: closed beta 50 user
- Production rollout staged (10% → 50% → 100%)
- Crashlytics dashboard monitor: target crash-free session > 99.5%

---

## 11. Critical Files to Create First

Saat mulai eksekusi, prioritaskan file berikut (urutan dependency):

**Backend:**
1. `backend/pyproject.toml` (Section 6.1 step 1)
2. `backend/app/config.py` (settings)
3. `backend/alembic/versions/0001_init.py` (schema Section 7)
4. `backend/app/main.py` + `app/api/v1/__init__.py`
5. `backend/app/services/llm/openai.py` (wrapper interface)
6. `backend/docker-compose.yml`

**Expo Frontend:**
1. `Book-Your-Life-app/package.json` (Dependencies Expo & RN)
2. `Book-Your-Life-app/app.json` (Expo manifest)
3. `Book-Your-Life-app/app/_layout.tsx` (Root layout routing)
4. `Book-Your-Life-app/utils/api.ts` (Axios configuration)
5. `Book-Your-Life-app/utils/db.ts` (SQLite setup)
6. `Book-Your-Life-app/app/(auth)/login.tsx` (Onboarding/Login)

**Reuse PRD assets:** PRD task breakdowns sudah granular, pakai langsung sebagai task issue di GitHub. Kontrak API di Section 8 = source of truth untuk OpenAPI.

---

## 12. Open Questions yang Masih Terbuka

| ID | Pertanyaan | Owner | Deadline | Default jika tidak diputuskan |
|---|---|---|---|---|
| Q2 | Print vendor & harga | Business | sebelum Phase 4 | Lulu Direct, hardcover Rp 350k, paperback Rp 180k |
| Q3 | Style ilustrasi (watercolor / sketch / digital art) | Design | sebelum Phase 3 | Watercolor warm-tone (default di Section 9.4) |
| Q4 | Pricing subscription (monthly/annual) | Business | sebelum Phase 3 | Monthly Rp 79k, Annual Rp 599k (~37% saving) |
| Q5 | Bahasa primary di launch (ID only vs ID+EN) | Andrea | sebelum Phase 1.3 | ID only, EN follow-up v1.1 |
| Q6 | Server region (untuk latency Indonesia) | DevOps | sebelum Phase 5 | Singapore (ap-southeast-1) |

---

## 13. Verifikasi End-to-End

Pasca Phase 4 selesai, jalankan happy path manual:

1. Buka aplikasi via Expo Go atau production build (APK/IPA).
2. Onboarding: nama "Andi", upload foto wajah, baca konsep, tap mulai.
3. Tunggu < 5 detik → pertanyaan pertama muncul.
4. Tulis entry 100 kata + 2 foto. Submit.
5. Logout, login balik, cek entry tetap ada.
6. Trigger manual: `celery -A app.tasks.celery_app call app.tasks.question_gen.generate_for_user --args='["<user_id>"]'`. FCM masuk ke device.
7. Buat 10 entry dummy via API. Generate book "3 bulan, gaya reflektif". Tunggu push.
8. Buka book preview, scroll semua bab, cek cover ilustrasi muncul (kalau face photo ada).
9. Order print hardcover. Cek webhook Lulu sandbox jalan, status update ke `printing`.
10. Crashlytics dashboard 0 fatal di smoke run.

**Automated tests minimum:**
- Backend: `pytest` coverage > 70% untuk `services/` dan `api/`.
- Frontend: `jest` dan `@testing-library/react-native` untuk custom hooks dan UI krusial.
- E2E: Detox atau Maestro untuk happy onboarding flow.

---

## 14. Critical Path

`Phase 0 (scaffold)` → `1.5 entry CRUD` → `1.6 question gen` → `1.7 push` → `2.2 RAG` → `3.2 book pipeline` → `3.5 image gen` → `4.4 polish` → `Launch`.

Total ~290h dengan tim 2–3 engineer (1 RN/Expo, 1 backend, 0.5 design/PM) → **±5 bulan**, sedikit lebih panjang dari estimasi PRD karena Phase 0 (scaffolding app Expo + backend bootstrap) belum dihitung di PRD.
