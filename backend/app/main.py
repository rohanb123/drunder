from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.config import get_settings
from app.schemas.report import ReportRequest, ReportResponse
from app.services.orchestrator import build_unified_report
from app.services.report_pdf import build_report_pdf


app = FastAPI(
    title="Clearpath API",
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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/report", response_model=ReportResponse)
async def create_report(body: ReportRequest) -> ReportResponse:
    """Product + suppliers → sanctions screening + regulatory section (unified JSON)."""
    try:
        return await build_unified_report(body)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/report/pdf")
async def create_report_pdf(body: ReportRequest) -> Response:
    """Same inputs as /report; returns application/pdf (ReportLab)."""
    report = await build_unified_report(body)
    pdf_bytes = build_report_pdf(report)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="clearpath-report.pdf"'},
    )
