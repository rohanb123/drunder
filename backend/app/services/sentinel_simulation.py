"""Gemini what-if simulation: prompts + JSON parse (mirrors simulation/lib/simulation.ts)."""

from __future__ import annotations

import json
import math
import re
from typing import Any, Iterator

JSON_SCHEMA = """{
  "summary": string,
  "marginImpactPercent": number,
  "marginImpactDirection": "up" | "down" | "neutral",
  "complianceBlockers": { "title": string, "detail": string, "severity": "high"|"medium"|"low" }[],
  "suggestedPivots": {
    "title": string,
    "rationale": string,
    "horizon": "near"|"mid"|"long",
    "fromCountry": string,
    "toCountry": string
  }[],
  "supplierComparison": {
    "before": { "name": string, "country": string, "risk": "high"|"medium"|"low", "spendSharePercent": number }[],
    "after": { "name": string, "country": string, "risk": "high"|"medium"|"low", "spendSharePercent": number, "deltaSpendSharePercent": number }[]
  },
  "riskLevel": "critical"|"elevated"|"moderate"|"low",
  "confidenceNote": string
}"""

RULES = """Rules:
- supplierComparison.before must list the same suppliers as the profile (same names; keep country codes as ISO 3166-1 alpha-2 uppercase where possible). Assign plausible baseline spendSharePercent summing to ~100.
- supplierComparison.after: same suppliers, post-shock risk and spend shares; deltaSpendSharePercent is change in share (negative means share dropped).
- suggestedPivots: include fromCountry and toCountry as ISO 3166-1 alpha-2 (e.g. CN, VN, MX). Each pivot is a plausible reroute.
- summary in JSON: 2–4 sentences distilled from your analysis."""


def _context_block(event: str, ctx: dict[str, Any]) -> str:
    suppliers = ctx.get("suppliers") or []
    hts = ctx.get("htsCodes") or []
    cats = ctx.get("categories") or []
    slines = "\n".join(f"- {s.get('name', '')} ({s.get('country', '')})" for s in suppliers) or "(none)"
    hlines = "\n".join(
        f"- {h.get('code', '')}" + (f": {h.get('description')}" if h.get("description") else "")
        for h in hts
    ) or "(none)"
    clines = "\n".join(f"- {c.get('name', '')}" for c in cats) or "(none)"
    return f"""You are a supply chain and trade compliance analyst. The user describes a hypothetical macro or policy event. Use ONLY the profile below as the company's baseline.

Supply chain profile: "{ctx.get("profileName", "")}"

Suppliers:
{slines}

HTS codes in scope:
{hlines}

Product categories:
{clines}

Hypothetical event:
"{event}\""""


def build_streaming_simulation_prompt(event: str, ctx: dict[str, Any]) -> str:
    base = _context_block(event, ctx)
    return f"""{base}

OUTPUT FORMAT (STRICT — follow exactly):
1) First write a flowing markdown analysis for executives (use ## headings and bullet points). Be specific to this profile and event. Aim for thorough coverage (multiple sections).
2) On its own line, output exactly this delimiter (nothing else on that line):
<<<SIM_JSON>>>
3) Immediately after, output a single JSON object with NO markdown fences. The JSON must match this shape:

{JSON_SCHEMA}

{RULES}"""


def build_json_only_simulation_prompt(event: str, ctx: dict[str, Any]) -> str:
    base = _context_block(event, ctx)
    return f"""{base}

OUTPUT: Respond with ONLY a single JSON object (no markdown fences, no delimiter line, no prose before or after). Shape:

{JSON_SCHEMA}

{RULES}"""


def _parse_risk(v: Any) -> str | None:
    return v if v in ("high", "medium", "low") else None


def parse_simulation_json(text: str) -> dict[str, Any] | None:
    trimmed = text.strip()
    m = re.search(r"\{[\s\S]*\}", trimmed)
    if not m:
        return None
    try:
        raw = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    margin = float(raw.get("marginImpactPercent", float("nan")))
    direction = raw.get("marginImpactDirection")
    if not isinstance(margin, (int, float)) or math.isnan(margin):
        return None
    if direction not in ("up", "down", "neutral"):
        return None
    risk = raw.get("riskLevel")
    if risk not in ("critical", "elevated", "moderate", "low"):
        return None
    comp = raw.get("supplierComparison") or {}
    before: list[dict[str, Any]] = []
    after: list[dict[str, Any]] = []
    if isinstance(comp, dict):
        if isinstance(comp.get("before"), list):
            for x in comp["before"]:
                if not isinstance(x, dict):
                    continue
                pr = _parse_risk(x.get("risk"))
                sp = float(x.get("spendSharePercent", float("nan")))
                if pr and sp == sp:
                    before.append(
                        {
                            "name": str(x.get("name", "")),
                            "country": str(x.get("country", "")).upper(),
                            "risk": pr,
                            "spendSharePercent": sp,
                        }
                    )
        if isinstance(comp.get("after"), list):
            for x in comp["after"]:
                if not isinstance(x, dict):
                    continue
                pr = _parse_risk(x.get("risk"))
                sp = float(x.get("spendSharePercent", float("nan")))
                delta = float(x.get("deltaSpendSharePercent", float("nan")))
                if pr and sp == sp and delta == delta:
                    after.append(
                        {
                            "name": str(x.get("name", "")),
                            "country": str(x.get("country", "")).upper(),
                            "risk": pr,
                            "spendSharePercent": sp,
                            "deltaSpendSharePercent": delta,
                        }
                    )
    pivots_raw = raw.get("suggestedPivots") if isinstance(raw.get("suggestedPivots"), list) else []
    suggested_pivots: list[dict[str, Any]] = []
    for p in pivots_raw:
        if not isinstance(p, dict):
            continue
        h = p.get("horizon")
        if h not in ("near", "mid", "long"):
            continue
        fc = str(p.get("fromCountry", "")).upper()
        tc = str(p.get("toCountry", "")).upper()
        if not fc or not tc:
            continue
        suggested_pivots.append(
            {
                "title": str(p.get("title", "")),
                "rationale": str(p.get("rationale", "")),
                "horizon": h,
                "fromCountry": fc,
                "toCountry": tc,
            }
        )
    blockers: list[dict[str, Any]] = []
    if isinstance(raw.get("complianceBlockers"), list):
        for b in raw["complianceBlockers"]:
            if not isinstance(b, dict):
                continue
            sev = _parse_risk(b.get("severity"))
            if sev:
                blockers.append(
                    {"title": str(b.get("title", "")), "detail": str(b.get("detail", "")), "severity": sev}
                )
    return {
        "summary": str(raw.get("summary", "")),
        "marginImpactPercent": margin,
        "marginImpactDirection": direction,
        "complianceBlockers": blockers,
        "suggestedPivots": suggested_pivots,
        "supplierComparison": {"before": before, "after": after},
        "riskLevel": risk,
        "confidenceNote": str(raw.get("confidenceNote", "")),
    }


def split_stream_buffer(buffer: str) -> tuple[str, str | None]:
    idx = buffer.find("<<<SIM_JSON>>>")
    if idx == -1:
        return buffer, None
    return buffer[:idx].rstrip(), buffer[idx + len("<<<SIM_JSON>>>") :].strip()


def iter_simulation_stream(*, api_key: str, model: str, prompt: str) -> Iterator[str]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=8192),
    ):
        t = getattr(chunk, "text", None) or ""
        if t:
            yield t
