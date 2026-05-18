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
    book_generation_openai_timeout_seconds: float = 20.0
    book_generation_openai_max_retries: int = 0

    replicate_api_token: str = ""
    replicate_model_flux: str = "black-forest-labs/flux-1.1-pro"

    # Clerk
    clerk_secret_key: str = ""          # sk_test_... — for REST API calls
    clerk_jwks_url: str = ""            # https://clerk.yourdomain.com/.well-known/jwks.json

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
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
