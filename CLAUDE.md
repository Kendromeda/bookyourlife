# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operational Landmines & Conventions

- **Master Plan**: Selalu rujuk `hasilkan-paket-dokumen-perencanaan-sunny-meerkat.md` sebagai source of truth arsitektur, API, DB schema, dan urutan fase pengerjaan.
- **Backend LLM Calls**: Jangan panggil OpenAI/Replicate langsung dari endpoint FastAPI untuk operasi berat (>2 detik). Wajib diproses melalui Celery task.
- **Prompt Templates**: Format LLM prompt di-render menggunakan Jinja2 di `app/prompts/*.j2`.
- **Celery Beat**: JANGAN buat schedule Celery per-user di beat scheduler karena `notif_hour` dinamis dan tidak scale. Gunakan pattern `fan_out_*`.
- **Database Migrations (Alembic)**: Gunakan `--autogenerate` untuk skema biasa, namun untuk perubahan terkait `pgvector` (index/extension), edit file migrasi secara **manual** karena autogenerate pgvector sering tidak reliable.
- **Auth**: Gunakan Clerk JWT verification via `python-jose` di `app/deps.py`. JANGAN hardcode token atau bypass auth.
- **Push Notifications**: Gunakan Expo Push API (`https://exp.host/--/api/v2/push/send`) via `FcmService.send()`. Token didaftarkan dari frontend via `POST /api/v1/users/me/fcm-token`.
- **Bahasa**: Identifier kode (variabel/fungsi) menggunakan bahasa Inggris. String user-facing menggunakan Bahasa Inggris.
- **Frontend Architecture**: Hindari menambah logic berat yang tidak perlu ke frontend Expo, serahkan operasi berat dan sumber kebenaran data ke server.
- **IDE Python Warnings**: Backend pakai Python 3.12 via uv virtualenv. Warning "Cannot find module" di IDE disebabkan IDE resolve ke Python 3.9 system — abaikan, tidak mempengaruhi runtime Docker.
