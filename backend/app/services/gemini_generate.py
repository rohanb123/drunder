"""Gemini text generation via `google.genai` (replaces deprecated `google.generativeai`)."""

from __future__ import annotations


def generate_text(
    *,
    api_key: str,
    model: str,
    prompt: str,
    temperature: float,
    max_output_tokens: int,
) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        ),
    )
    if response is None:
        return ""
    raw = getattr(response, "text", None)
    return (raw or "").strip()
