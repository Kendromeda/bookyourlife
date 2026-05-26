"""Thin Replicate Flux client for img2img photo transforms (Prompt 9).

Replicate's `replicate.run()` blocks until the prediction completes and
returns either a URL or a list of URLs depending on the model. We always
download the bytes here so the caller (book pipeline) gets a single
`bytes` blob it can hand to R2 upload.
"""
from __future__ import annotations

import httpx
import replicate
import structlog

from app.config import get_settings

logger = structlog.get_logger()


# Style preset -> Flux img2img tuning. `prompt_strength` is the denoising
# fraction (0 = original photo, 1 = ignore photo). Plan §5 Prompt 9 table.
STYLE_PROMPTS: dict[str, str] = {
    "watercolor": (
        "watercolor painting style, soft brush strokes on cold-pressed paper, "
        "hand-painted, gentle bleeds, muted palette"
    ),
    "pencil": (
        "graphite pencil sketch, fine cross-hatching, monochrome with sparse "
        "warm wash, paper grain"
    ),
    "vintage": (
        "vintage 35mm film photograph, faded colors, slight grain, warm cast, "
        "soft focus, kodak portra 400 feel"
    ),
    "anime": (
        "Studio Ghibli style hand-drawn illustration, painterly textures, "
        "soft lighting, warm palette"
    ),
}

STYLE_STRENGTH: dict[str, float] = {
    "watercolor": 0.55,
    "pencil": 0.60,
    "vintage": 0.40,
    "anime": 0.60,
}

NEGATIVE_PROMPT = (
    "text, watermark, logo, signature, deformed hands, deformed face, "
    "extra fingers, blurry, low quality, distorted features, cropped, "
    "frame, border"
)


def replicate_configured() -> bool:
    return bool(get_settings().replicate_api_token)


def style_transfer_photo(
    *,
    source_url: str,
    style_preset: str,
) -> bytes:
    """Run Flux img2img and return the transformed image bytes.

    Raises on transport / model failure so the caller can mark the asset
    as failed_fallback and use the original photo instead.
    """
    settings = get_settings()
    if not settings.replicate_api_token:
        raise RuntimeError("Replicate API token is not configured")

    prompt = STYLE_PROMPTS.get(style_preset, STYLE_PROMPTS["watercolor"])
    strength = STYLE_STRENGTH.get(style_preset, 0.55)

    client = replicate.Client(api_token=settings.replicate_api_token)
    output = client.run(
        settings.replicate_model_flux_img2img,
        input={
            "image": source_url,
            "prompt": prompt,
            "prompt_strength": strength,
            "guidance": 3.5,
            "output_quality": 90,
            "aspect_ratio": "match_input_image",
            "negative_prompt": NEGATIVE_PROMPT,
        },
    )

    url = _first_url(output)
    if not url:
        raise RuntimeError("Replicate returned no output URL")

    response = httpx.get(url, timeout=settings.replicate_request_timeout_seconds)
    response.raise_for_status()
    return response.content


def _first_url(output: object) -> str | None:
    if output is None:
        return None
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        return first if isinstance(first, str) else None
    # Replicate sometimes returns a file-like object with .url
    url = getattr(output, "url", None)
    if isinstance(url, str):
        return url
    return None
