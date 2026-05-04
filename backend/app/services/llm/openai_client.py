from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings


class OpenAIClient:
    def __init__(self, api_key: str | None = None) -> None:
        settings = get_settings()
        self._client = AsyncOpenAI(api_key=api_key or settings.openai_api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def generate_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        max_tokens: int = 256,
        temperature: float = 0.7,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return (response.choices[0].message.content or "").strip()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def embed(self, *, texts: list[str], model: str) -> list[list[float]]:
        response = await self._client.embeddings.create(model=model, input=texts)
        return [item.embedding for item in response.data]
