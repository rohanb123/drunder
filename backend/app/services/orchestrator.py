"""Fan out the three pipelines in parallel for POST /report."""

import asyncio

from app.schemas.report import ReportRequest, ReportResponse
from app.services.regulatory import run_regulatory_rag
from app.services.sanctions import run_supplier_screening
from app.services.tariff import run_tariff_pipeline


async def build_unified_report(body: ReportRequest) -> ReportResponse:
    supplier_risk, tariff_exposure, regulatory = await asyncio.gather(
        run_supplier_screening(body.suppliers),
        run_tariff_pipeline(body.product_description, body.suppliers),
        run_regulatory_rag(body.product_description),
    )
    return ReportResponse(
        product_description=body.product_description,
        supplier_risk=supplier_risk,
        tariff_exposure=tariff_exposure,
        regulatory=regulatory,
    )
