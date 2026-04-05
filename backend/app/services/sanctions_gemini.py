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
    CSL search returned zero results. Ask Gemini whether the **supplier name** (third party)
    still warrants extra sanctions diligence—without accusing the customer company of wrongdoing.
    """
    from app.services.gemini_generate import generate_text

    prompt = f"""You support **supplier due diligence** for importers and manufacturers. They paste a **vendor or supplier legal name** to screen; you are **not** judging their company—you are commenting only on **whether this name string** merits extra review when the U.S. Trade.gov Consolidated Screening List API returned **no hits** ({CSL_API_DOCS}).

**Supplier name to assess (third party, not the user’s company):**
"{supplier_name}"

Assess **only** that string. Consider: typos, look-alike spellings, ambiguous names, or resemblance to **widely known sanctioned / restricted parties** (OFAC SDN-style, etc.).

**Tone (critical):**
- Write about **the supplier name**, never accuse the **company running this check** of evasion, fraud, or bad intent.
- If the name **closely resembles a famous ordinary commercial brand** (e.g. a misspelling of a major software or consumer brand) with **no** plausible link to a sanctions-listed entity, treat it as **likely a typo or wrong entity** → **"clear"** or **"review"** with a **neutral** note (e.g. confirm the intended legal entity spelling)—**not** "flagged" and **not** language about "deliberate evasion."
- **"flagged"** only when the name would reasonably suggest a **known heavily sanctioned or clearly restricted party**—not merely a misspelled famous company that is **not** a sanctions target.

Respond with **JSON only**, no markdown:
{{"status":"clear"|"review"|"flagged","reason":"one short neutral sentence about the supplier name only"}}

Rules:
- "flagged": only for clear-cut sanctions-style risk from the **name itself**.
- "review": ambiguity, unclear spelling, or suggest double-checking the legal entity.
- "clear": ordinary commercial name, or obvious benign typo of a non-sanctions household name with no sanctions nexus.
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
        return "review", "That review step returned unreadable output. Try again or decide manually."
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return "review", "That review step returned invalid data. Try again or decide manually."
    raw = str(obj.get("status", "")).lower().strip()
    if raw not in ("clear", "review", "flagged"):
        return "review", "That review step returned an unclear result. Decide manually."
    reason = obj.get("reason")
    note = str(reason).strip() if reason else None
    return raw, note
