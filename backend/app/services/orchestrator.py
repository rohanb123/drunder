"""Fan out sanctions screening and regulatory RAG in parallel for POST /report (full pipeline)."""

import asyncio

from app.schemas.report import ReportRequest, ReportResponse
from app.services.regulatory import run_regulatory_rag
from app.services.sanctions import run_supplier_screening


async def build_unified_report(body: ReportRequest) -> ReportResponse:
    supplier_risk, regulatory = await asyncio.gather(
        run_supplier_screening(body.suppliers),
        run_regulatory_rag(body.product_description),
    )
    return ReportResponse(
        product_description=body.product_description,
        supplier_risk=supplier_risk,
        regulatory=regulatory,
    )
