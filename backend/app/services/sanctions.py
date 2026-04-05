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
from app.services.sanctions_name_filter import filter_csl_hits_by_similarity


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
    *,
    hit_scores: list[float] | None = None,
) -> SupplierRiskResult:
    """
    Iterate CSL `results` only (no Gemini). Exact name/alias match → flagged.
    Non-empty list but no exact match → review (API surfaced possible matches).
    hit_scores[i] parallels raw_results[i] when provided (for fuzzy_score on review).
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
                notes=None,
            )

    first = _first_valid_hit(raw_results)
    if first is None:
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="We couldn't read these screening results. Please review manually.",
        )
    fs = float(hit_scores[0]) if hit_scores and len(hit_scores) == len(raw_results) else None
    return SupplierRiskResult(
        supplier_name=supplier_name,
        status="review",
        match=_hit_to_match(first),
        fuzzy_score=fs,
        notes=(
            "Similar names turned up on the U.S. list, but none exactly match your supplier. "
            "Review the hit below before treating this as cleared."
        ),
    )


async def _gemini_when_csl_empty(
    supplier_name: str,
    settings: Settings,
    *,
    official_list_ran: bool = True,
) -> SupplierRiskResult:
    """
    No rows from the government list (or list wasn't queried). Optional secondary name review.
    official_list_ran=False means list credentials missing — user-facing copy stays non-technical.
    """
    gkey = (settings.google_api_key or "").strip()
    if not gkey:
        if official_list_ran:
            msg = (
                "No matches on the official U.S. sanctions list for this spelling. "
                "A secondary name review isn't available here—confirm the legal entity yourself if unsure."
            )
        else:
            msg = (
                "Official sanctions list search isn't connected. "
                "No secondary review ran—treat screening as incomplete until your organization enables it."
            )
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes=msg,
        )
    try:
        status, reason = await asyncio.to_thread(
            assess_supplier_when_csl_empty,
            supplier_name,
            api_key=gkey,
            model=settings.gemini_sanctions_model,
        )
    except Exception:  # noqa: BLE001
        return SupplierRiskResult(
            supplier_name=supplier_name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="Secondary name review didn't finish. Try again, or rely on the list search result only.",
        )
    default = (
        "No matches on the official list. A short name review was applied."
        if official_list_ran
        else "List search wasn't used; a short name review was applied."
    )
    notes = (reason or default).strip()
    return SupplierRiskResult(
        supplier_name=supplier_name,
        status=status,
        match=None,
        fuzzy_score=None,
        notes=notes,
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
            notes="Please enter a supplier name.",
        )

    key = (settings.trade_gov_api_key or "").strip()
    if not key:
        return await _gemini_when_csl_empty(name, settings, official_list_ran=False)

    try:
        raw_results = await search_consolidated_screening_list(
            client,
            subscription_key=key,
            name=name,
            search_url=settings.trade_gov_csl_search_url,
        )
    except httpx.HTTPStatusError:
        return SupplierRiskResult(
            supplier_name=name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="Screening couldn't be completed right now. Please try again later.",
        )
    except httpx.RequestError:
        return SupplierRiskResult(
            supplier_name=name,
            status="review",
            match=None,
            fuzzy_score=None,
            notes="We couldn't reach the screening service. Check your connection and try again.",
        )

    if not raw_results:
        return await _gemini_when_csl_empty(name, settings, official_list_ran=True)

    filtered, scores = filter_csl_hits_by_similarity(
        raw_results,
        name,
        min_similarity=settings.sanctions_name_similarity_threshold,
    )
    if not filtered:
        return await _gemini_when_csl_empty(name, settings, official_list_ran=True)

    return classify_supplier_from_csl_results(name, filtered, hit_scores=scores)


async def run_supplier_screening(suppliers: list[SupplierInput]) -> list[SupplierRiskResult]:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        return list(
            await asyncio.gather(
                *(_screen_one_supplier(s, client=client, settings=settings) for s in suppliers),
            ),
        )
