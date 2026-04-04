"""
Section 2 — Tariff exposure.

Flow (to implement): Gemini classifies product → 4-digit HTS chapter → Trade.gov Tariff Rates API
per supplier country of origin.
"""

from app.config import get_settings
from app.schemas.report import SupplierInput, TariffExposureResult


async def run_tariff_pipeline(
    product_description: str,
    suppliers: list[SupplierInput],
) -> list[TariffExposureResult]:
    """
    Classify product and fetch duty rates per origin.

    Stub: placeholder chapter and no rate until APIs are connected.
    """
    _ = get_settings()
    _ = product_description
    out: list[TariffExposureResult] = []
    for s in suppliers:
        out.append(
            TariffExposureResult(
                supplier_name=s.name,
                country_of_origin=s.country_of_origin,
                hts_chapter="0000",
                duty_rate_percent=None,
                api_source="trade.gov_tariff_rates (stub — set GOOGLE_API_KEY + TRADE_GOV_API_KEY)",
            )
        )
    return out
