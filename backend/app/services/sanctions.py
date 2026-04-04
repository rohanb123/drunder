"""
Section 1 — Sanctions (spec checklist).

1. CSL client: raw `results` from Trade.gov search (see `csl_client.search_consolidated_screening_list`).
2. Matching: iterate API rows — exact normalized name/alias → flagged; rows but no exact match → review;
   empty results → not decided here (Gemini).
3. Gemini: only when CSL returns **no** rows; supplier name + short context in prompt.
4. Wired via `run_supplier_screening` → `POST /report` (`build_unified_report`).
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.schemas.report import MatchedListEntry, SupplierInput, SupplierRiskResult
from app.services.csl_client import search_consolidated_screening_list
from app.services.sanctions_gemini import assess_supplier_when_csl_empty


def _normalize_name(s: str) -> str:
    return " ".join(s.strip().lower().split())


def _hit_to_match(hit: dict[str, Any]) -> MatchedListEntry:
    addresses = hit.get("addresses") or []
    country = None
    if isinstance(addresses, list) and addresses:
        first = addresses[0]
        if isinstance(first, dict):
            country = first.get("country")
    alt = hit.get("alt_names")
    aliases = list(alt) if isinstance(alt, list) else []
    return MatchedListEntry(
        source_list=str(hit.get("source") or "Unknown source"),
        entity_type=hit.get("type"),
        matched_name=str(hit.get("name") or ""),
        aliases=aliases,
        country=country,
    )


def _hit_exact_match(hit: dict[str, Any], query_norm: str) -> bool:
    names: list[str] = []
    n = hit.get("name")
    if n:
        names.append(_normalize_name(str(n)))
    alt = hit.get("alt_names")
    if isinstance(alt, list):
        names.extend(_normalize_name(str(x)) for x in alt if x)
    return bool(query_norm) and query_norm in names


def _first_valid_hit(results: list[dict[str, Any]]) -> dict[str, Any] | None:
    for hit in results:
        if isinstance(hit, dict):
            return hit
    return None


def classify_supplier_from_csl_results(
    supplier_name: str,
    raw_results: list[dict[str, Any]],
) -> SupplierRiskResult:
    """
    Iterate CSL `results` only (no Gemini). Exact name/alias match → flagged.
    Non-empty list but no exact match → review (API surfaced possible matches).
    """
    qn = _normalize_name(supplier_name)
    for hit in raw_results:
        if not isinstance(hit, dict):
            continue
        if _hit_exact_match(hit, qn):
            return SupplierRiskResult(
                supplier_name=supplier_name,
                status="flagged",
                match=_hit_to_match(hit),
                fuzzy_score=None,
                notes=(
                    "CSL returned an entry whose primary name or alias exactly matches the supplier name "
                    "(normalized)."
                ),
            )

    first = _first_valid_hit(raw_results)
    if first is None:
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="CSL returned payload without parseable entity rows; manual review recommended.",
        )
    return SupplierRiskResult(
        supplier_name=supplier_name,
        status="review",
        match=_hit_to_match(first),
        fuzzy_score=None,
        notes=(
            "CSL returned one or more list entries for this search, but none exactly match the supplier name "
            "(normalized). The API’s own search surfaced these rows — verify before treating as clearance."
        ),
    )


async def _gemini_when_csl_empty(
    supplier_name: str,
    settings: Settings,
    *,
    extra_note: str | None = None,
) -> SupplierRiskResult:
    gkey = (settings.google_api_key or "").strip()
    if not gkey:
        msg = "CSL returned no rows and GOOGLE_API_KEY is not set; Gemini fallback skipped."
        if extra_note:
            msg = f"{msg} {extra_note}"
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes=msg.strip(),
        )
    try:
        status, reason = await asyncio.to_thread(
            assess_supplier_when_csl_empty,
            supplier_name,
            api_key=gkey,
            model=settings.gemini_sanctions_model,
        )
    except Exception as e:  # noqa: BLE001
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes=f"CSL returned no rows; Gemini fallback failed: {e!s}",
        )
    notes = reason or "CSL returned no rows; Gemini assessment applied."
    if extra_note:
        notes = f"{notes} {extra_note}"
    return SupplierRiskResult(
        supplier_name=supplier_name,
        status=status,
        match=None,
        fuzzy_score=None,
        notes=notes.strip(),
    )


async def _screen_one_supplier(
    supplier: SupplierInput,
    *,
    client: httpx.AsyncClient,
    settings: Settings,
) -> SupplierRiskResult:
    name = supplier.name.strip()
    if not name:
        return SupplierRiskResult(
            supplier_name=supplier.name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="Supplier name is empty after trimming.",
        )

    key = (settings.trade_gov_api_key or "").strip()
    if not key:
        return await _gemini_when_csl_empty(
            name,
            settings,
            extra_note="(TRADE_GOV_API_KEY not set; CSL not queried.)",
        )

    try:
        raw_results = await search_consolidated_screening_list(
            client,
            subscription_key=key,
            name=name,
            search_url=settings.trade_gov_csl_search_url,
        )
    except httpx.HTTPStatusError as e:
        detail = ""
        try:
            detail = e.response.text[:300]
        except Exception:
            pass
        return SupplierRiskResult(
            supplier_name=name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes=f"Trade.gov CSL request failed (HTTP {e.response.status_code}). {detail}".strip(),
        )
    except httpx.RequestError as e:
        return SupplierRiskResult(
            supplier_name=name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes=f"Trade.gov CSL network error: {e!s}",
        )

    if not raw_results:
        return await _gemini_when_csl_empty(name, settings)

    return classify_supplier_from_csl_results(name, raw_results)


async def run_supplier_screening(suppliers: list[SupplierInput]) -> list[SupplierRiskResult]:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        return list(
            await asyncio.gather(
                *(_screen_one_supplier(s, client=client, settings=settings) for s in suppliers),
            ),
        )
