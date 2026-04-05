import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from app.config import get_settings
from app.routers import sentinel as sentinel_router
from app.routers import browser_agent as browser_agent_router
from app.schemas.report import (
    ReportPdfRequest,
    ReportRequest,
    ReportResponse,
    SupplyChainAnalysis,
    SupplyChainStageUpdateRequest,
)
from app.services.orchestrator import build_unified_report
from app.services.supply_chain_refine import refine_supply_chain_after_stage_edit
from app.services.regulatory_paths import resolve_regulatory_pdf_safe, resolve_under_backend
from app.services.report_pdf import build_report_pdf

logger = logging.getLogger(__name__)

app = FastAPI(
    title="ClearPath API",
    description="Supplier sanctions screening and US regulatory compliance report.",
    version="0.1.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentinel_router.router)
app.include_router(browser_agent_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/regulatory/pdfs")
async def get_regulatory_source_pdf(
    path: str = Query(
        ...,
        min_length=1,
        max_length=512,
        description="Relative path under the regulatory PDF folder, e.g. fda/my-guide.pdf",
    ),
) -> FileResponse:
    """Serve an ingested guidance PDF for source links (fragment #page=N is applied by the browser)."""
    settings = get_settings()
    root = resolve_under_backend(settings.regulatory_pdfs_path)
    file_path = resolve_regulatory_pdf_safe(root, path)
    if file_path is None:
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(
        str(file_path),
        media_type="application/pdf",
        filename=file_path.name,
        headers={"Content-Disposition": f'inline; filename="{file_path.name}"'},
    )


@app.post("/report/supply-chain/update-stage", response_model=SupplyChainAnalysis)
async def update_supply_chain_stage(body: SupplyChainStageUpdateRequest) -> SupplyChainAnalysis:
    """Re-screen edited suppliers (gov list path), then one Gemini call to refactor the full chain when configured."""
    try:
        return await refine_supply_chain_after_stage_edit(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/report", response_model=ReportResponse)
async def create_report(body: ReportRequest) -> ReportResponse:
    """Product + suppliers → sanctions screening + regulatory section (unified JSON)."""
    try:
        return await build_unified_report(body)
    except Exception:  # noqa: BLE001
        logger.exception("Report generation failed")
        raise HTTPException(
            status_code=500,
            detail="We couldn't generate this report. Please try again in a moment.",
        ) from None


@app.post("/report/pdf")
async def create_report_pdf(body: ReportPdfRequest) -> Response:
    """Product + suppliers like /report; optional what_if adds a scenario appendix page."""
    req = ReportRequest(product_description=body.product_description, suppliers=body.suppliers)
    try:
        report = await build_unified_report(req)
    except Exception:  # noqa: BLE001
        logger.exception("PDF report generation failed")
        raise HTTPException(
            status_code=500,
            detail="We couldn't generate this PDF. Please try again in a moment.",
        ) from None
    pdf_bytes = build_report_pdf(report, body.what_if)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="ClearPath-report.pdf"'},
    )
