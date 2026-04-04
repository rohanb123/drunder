"""Server-side PDF from structured report JSON using ReportLab."""

from io import BytesIO

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.schemas.report import ReportResponse


def build_report_pdf(report: ReportResponse) -> bytes:
    """Minimal PDF scaffold; expand with styles, sections, and tables."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - 72
    c.setFont("Helvetica-Bold", 14)
    c.drawString(72, y, "Clearpath — Compliance Report")
    y -= 24
    c.setFont("Helvetica", 10)
    for line in report.product_description[:500].splitlines()[:20]:
        c.drawString(72, y, line[:100])
        y -= 12
        if y < 72:
            c.showPage()
            y = height - 72
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
