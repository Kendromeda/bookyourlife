from typing import Protocol


class LLMClient(Protocol):
    async def generate_text(
        self,
        *,
        system: str,
        user: str,
        model: str,
        max_tokens: int = 256,
        temperature: float = 0.7,
    ) -> str: ...

    async def embed(self, *, texts: list[str], model: str) -> list[list[float]]: ...
