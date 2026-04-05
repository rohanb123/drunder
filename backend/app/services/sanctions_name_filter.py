"""
Post-filter Trade.gov CSL fuzzy hits: drop weak name/alias matches before showing users.

Uses RapidFuzz ratio + token_sort_ratio only (not partial_ratio) to avoid substring traps
(e.g. "jam" inside "jamba juice" vs an alias).
"""

from __future__ import annotations

from typing import Any

from rapidfuzz import fuzz


def _normalize(s: str) -> str:
    return " ".join(s.strip().lower().split())


def _hit_exact_match(hit: dict[str, Any], query_norm: str) -> bool:
    names: list[str] = []
    n = hit.get("name")
    if n:
        names.append(_normalize(str(n)))
    alt = hit.get("alt_names")
    if isinstance(alt, list):
        names.extend(_normalize(str(x)) for x in alt if x)
    return bool(query_norm) and query_norm in names


def _candidate_strings(hit: dict[str, Any]) -> list[str]:
    out: list[str] = []
    n = hit.get("name")
    if n:
        out.append(_normalize(str(n)))
    for a in hit.get("alt_names") or []:
        if a:
            out.append(_normalize(str(a)))
    return [x for x in out if x]


def hit_name_similarity(query_norm: str, hit: dict[str, Any]) -> float:
    """0.0–1.0 best match vs primary name and aliases (excludes partial_ratio)."""
    best = 0.0
    for cand in _candidate_strings(hit):
        r = max(
            fuzz.ratio(query_norm, cand) / 100.0,
            fuzz.token_sort_ratio(query_norm, cand) / 100.0,
        )
        best = max(best, r)
    return best


def filter_csl_hits_by_similarity(
    raw_results: list[dict[str, Any]],
    supplier_name: str,
    *,
    min_similarity: float,
) -> tuple[list[dict[str, Any]], list[float]]:
    """
    Keep hits that are exact name/alias matches OR similarity >= min_similarity.
    Returns parallel lists (hit, score) for kept rows; score is 1.0 for exact, else computed.
    """
    qn = _normalize(supplier_name)
    kept: list[dict[str, Any]] = []
    scores: list[float] = []
    for hit in raw_results:
        if not isinstance(hit, dict):
            continue
        if _hit_exact_match(hit, qn):
            kept.append(hit)
            scores.append(1.0)
            continue
        sim = hit_name_similarity(qn, hit)
        if sim >= min_similarity:
            kept.append(hit)
            scores.append(round(sim, 4))
    return kept, scores
