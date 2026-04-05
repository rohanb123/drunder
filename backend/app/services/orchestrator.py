"""Fan out sanctions screening and regulatory RAG in parallel for POST /report (full pipeline)."""

import asyncio

from app.schemas.report import ReportRequest, ReportResponse, SupplierInput, SupplierRiskResult
from app.services.regulatory import run_regulatory_rag
from app.services.sanctions import run_supplier_screening
from app.services.supply_chain_gemini import infer_supply_chain_sync


def _attach_supplier_roles(
    results: list[SupplierRiskResult],
    suppliers: list[SupplierInput],
) -> list[SupplierRiskResult]:
    """Echo each supplier's role onto screening results for client display (additive)."""
    out: list[SupplierRiskResult] = []
    for i, r in enumerate(results):
        role = suppliers[i].role if i < len(suppliers) else ""
        out.append(r.model_copy(update={"role": role}))
    return out


async def build_unified_report(body: ReportRequest) -> ReportResponse:
    screening_task = asyncio.create_task(run_supplier_screening(body.suppliers))
    regulatory_task = asyncio.create_task(run_regulatory_rag(body.product_description))
    raw_risk = await screening_task
    supplier_risk = _attach_supplier_roles(raw_risk, body.suppliers)
    supply_chain_task = asyncio.create_task(
        asyncio.to_thread(
            infer_supply_chain_sync,
            body.product_description,
            body.suppliers,
            supplier_risk,
        ),
    )
    regulatory, supply_chain = await asyncio.gather(regulatory_task, supply_chain_task)
    return ReportResponse(
        product_description=body.product_description,
        supplier_risk=supplier_risk,
        regulatory=regulatory,
        supply_chain=supply_chain,
    )
