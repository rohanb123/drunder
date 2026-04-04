"""Gemini Flash fallback when the CSL API returns no rows for the supplier search."""

import json
from typing import Literal

Status = Literal["clear", "review", "flagged"]

CSL_API_DOCS = (
    "https://developer.trade.gov/api-details#api=consolidated-screening-list&operation=search"
)


def assess_supplier_when_csl_empty(
    supplier_name: str,
    *,
    api_key: str,
    model: str = "gemini-2.5-flash-lite",
) -> tuple[Status, str | None]:
    """
    CSL search returned zero results. Ask Gemini whether the name still suggests sanctions risk.

    Returns (status, notes). Prefer review when uncertain; flag only for clear-cut cases.
    """
    from app.services.gemini_generate import generate_text

    prompt = f"""You are assisting with export/sanctions compliance pre-screening.

The U.S. Trade.gov Consolidated Screening List search API ({CSL_API_DOCS}) returned **zero** results for this supplier name:
"{supplier_name}"

Without inventing specific list matches or citations, assess whether this name (or an obvious variant) is **likely** to refer to a widely known heavily sanctioned entity, a military/industrial complex name under U.S. restrictions, or a state actor commonly associated with OFAC/BIS-style lists.

Respond with **JSON only**, no markdown, in this exact shape:
{{"status":"clear"|"review"|"flagged","reason":"one short sentence"}}

Rules:
- "flagged" only if the name clearly points to a well-known sanctioned / restricted party.
- "review" if there is meaningful ambiguity or the name could plausibly relate to a restricted party.
- "clear" for ordinary commercial names with no plausible sanctions concern.
"""
    text = generate_text(
        api_key=api_key,
        model=model,
        prompt=prompt,
        temperature=0.1,
        max_output_tokens=256,
    )
    return _parse_gemini_status(text)


def _parse_gemini_status(text: str) -> tuple[Status, str | None]:
    start = text.find("{")
    if start < 0:
        return "review", "Gemini fallback returned unparsable output; manual review recommended."
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return "review", "Gemini fallback returned invalid JSON; manual review recommended."
    raw = str(obj.get("status", "")).lower().strip()
    if raw not in ("clear", "review", "flagged"):
        return "review", "Gemini fallback returned unknown status; manual review recommended."
    reason = obj.get("reason")
    note = str(reason).strip() if reason else None
    return raw, note
