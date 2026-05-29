from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["local", "staging", "production"] = "local"
    log_level: str = "INFO"

    database_url: str
    sync_database_url: str
    redis_url: str

    openai_api_key: str = ""
    openai_model_question: str = "gpt-4o"
    openai_model_narrative: str = "gpt-4o"
    openai_model_embedding: str = "text-embedding-3-small"
    openai_model_whisper: str = "whisper-1"
    openai_model_image: str = "gpt-image-2"
    openai_image_size: str = "1024x1024"
    # Quality tiers (gpt-image-2). The cover is the hero, so it earns `high`;
    # interior illustrations use `medium`, which is ~4x cheaper per image with
    # no visible loss at A5 print size. Without these, the API defaults to
    # `auto` (often `high`) on every image — the main cost overrun.
    openai_image_quality_cover: str = "high"
    openai_image_quality_interior: str = "medium"
    book_generation_ai_enabled: bool = True
    book_generation_openai_timeout_seconds: float = 20.0
    book_generation_openai_max_retries: int = 0
    # Parallel cap for S5 image fan-out — respects OpenAI/Replicate RPM tiers
    # without serializing 40+ images.
    book_generation_image_concurrency: int = 6
    # AI image budget is tied to book STRUCTURE (chapters), never to entry
    # count, so a 200-entry book generates as many images as a 30-entry one.
    # Chapter openers are capped; entry illustrations are limited to the
    # highest-value text-only entries (~1 per chapter). Everything else renders
    # as plain Diary Style text.
    book_generation_max_chapter_openers: int = 12
    book_generation_max_entry_images: int = 12
    # Two-stage prompt composition: LLM first writes the image prompt, then
    # text-to-image API consumes it. Disable to fall back to the static
    # Python-built prompts.
    book_generation_use_llm_image_prompts: bool = True

    replicate_api_token: str = ""
    replicate_model_flux: str = "black-forest-labs/flux-1.1-pro"
    # img2img model for user-photo style transfer (Prompt 9). Flux dev/schnell
    # supports the `image` + `prompt_strength` inputs; Pro 1.1 does not.
    replicate_model_flux_img2img: str = "black-forest-labs/flux-dev"
    replicate_request_timeout_seconds: float = 240.0

    # Clerk
    clerk_secret_key: str = ""          # sk_test_... — for REST API calls
    clerk_jwks_url: str = ""            # https://clerk.yourdomain.com/.well-known/jwks.json
    clerk_issuer: str = ""              # https://clerk.yourdomain.com — checked vs token `iss`
    clerk_audience: str = ""            # optional; only enforced when set
    # Authorized parties (`azp`) — Clerk frontend origins allowed to mint tokens.
    clerk_authorized_parties: list[str] = Field(default_factory=list)
    clerk_jwks_cache_seconds: int = 600  # refresh JWKS at most this often (key rotation)

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "lifebook-dev"
    r2_endpoint: str = ""
    r2_public_base_url: str = ""

    lulu_client_key: str = ""
    lulu_client_secret: str = ""
    lulu_api_base: str = "https://api.sandbox.lulu.com"

    revenuecat_webhook_secret: str = ""

    api_v1_prefix: str = "/api/v1"
    # Explicit web origins. Empty = no browser CORS (mobile-only). The "*"
    # wildcard is rejected in production (see app.main._resolve_cors_origins).
    cors_origins: list[str] = Field(default_factory=list)

    # Rate limiting. Default "memory://" keeps single-process dev/test working
    # with no external dependency; set to the Redis URL in production so limits
    # are shared across worker processes.
    rate_limit_enabled: bool = True
    rate_limit_storage_uri: str = "memory://"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
