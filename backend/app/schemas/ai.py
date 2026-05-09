from pydantic import BaseModel, Field


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


class ImageGenRequest(BaseModel):
    body: str = Field(min_length=30, max_length=10_000)


class ImageGenResponse(BaseModel):
    job_id: str


class ImageJobStatusResponse(BaseModel):
    status: str
    storage_key: str | None = None
    public_url: str | None = None
    error: str | None = None
