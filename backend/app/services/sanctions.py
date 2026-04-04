"""
Section 1 — Supplier risk.

Flow (to implement): Trade.gov Consolidated Screening List API → rapidfuzz on names →
optional Gemini disambiguation for gray-zone matches.
"""

from app.config import get_settings
from app.schemas.report import MatchedListEntry, SupplierInput, SupplierRiskResult


async def run_supplier_screening(suppliers: list[SupplierInput]) -> list[SupplierRiskResult]:
    """
    Screen suppliers against consolidated lists.

    Stub: returns structured placeholders. Wire TRADE_GOV_API_KEY, httpx, rapidfuzz, Gemini.
    """
    _ = get_settings()
    results: list[SupplierRiskResult] = []
    for s in suppliers:
        results.append(
            SupplierRiskResult(
                supplier_name=s.name,
                status="clear",
                match=None,
                fuzzy_score=None,
                notes="Stub: connect Consolidated Screening List API + rapidfuzz + Gemini disambiguation.",
            )
        )
    return results
