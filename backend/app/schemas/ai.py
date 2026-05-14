from typing import Literal

from pydantic import BaseModel, Field, model_validator


class TitleSuggestionsRequest(BaseModel):
    body: str = Field(min_length=50, max_length=10_000)


class TitleSuggestionsResponse(BaseModel):
    titles: list[str]


class WritingPromptsRequest(BaseModel):
    body: str = Field(min_length=50, max_length=10_000)


class WritingPromptsResponse(BaseModel):
    prompts: list[str]


class HighlightsRequest(BaseModel):
    body: str = Field(min_length=50, max_length=10_000)


class HighlightsResponse(BaseModel):
    highlights: list[str]


ImageStyle = Literal["poetic", "cinematic", "minimalist", "dreamy", "illustrated", "watercolor"]
ImageIntensity = Literal["subtle", "balanced", "expressive"]
ImagePurpose = Literal["entry_visual", "book_cover", "chapter_opener", "quote_page"]


class ImageGenRequest(BaseModel):
    body: str = Field(default="", max_length=10_000)
    prompt: str | None = Field(default=None, max_length=1_500)
    style: ImageStyle = "cinematic"
    intensity: ImageIntensity = "balanced"
    purpose: ImagePurpose = "entry_visual"

    @model_validator(mode="after")
    def require_prompt_or_body(self) -> "ImageGenRequest":
        if not self.body.strip() and not (self.prompt or "").strip():
            raise ValueError("Image generation requires an entry body or prompt")
        return self


class ImageGenResponse(BaseModel):
    job_id: str


class ImageJobStatusResponse(BaseModel):
    status: str
    storage_key: str | None = None
    public_url: str | None = None
    error: str | None = None


class AiDiagnosticsResponse(BaseModel):
    openai_configured: bool
    r2_configured: bool
    image_model: str
    image_size: str
    queue_reachable: bool
