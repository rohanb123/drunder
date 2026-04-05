"""Server-side PDF from structured report JSON using ReportLab (platypus)."""

from __future__ import annotations

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from app.schemas.report import ReportResponse, RegulatoryBullet, SupplierRiskResult

_STATUS_ORDER = {"flagged": 0, "review": 1, "clear": 2}


def _sorted_supplier_risk(rows: list[SupplierRiskResult]) -> list[SupplierRiskResult]:
    """Flagged first, then review, then clear; tie-break by name."""
    return sorted(
        rows,
        key=lambda r: (
            _STATUS_ORDER.get(str(r.status), 99),
            (r.supplier_name or "").lower(),
        ),
    )


def _para(text: str, style) -> Paragraph:
    safe = escape(text or "").replace("\n", "<br/>")
    return Paragraph(safe, style)


def _bullet_flowables(
    bullets: list[RegulatoryBullet],
    body_style,
    cite_labels: dict[str, str],
) -> list:
    """ListItem paragraphs for regulatory bullets; append source refs when chunk ids exist."""
    items: list[ListItem] = []
    for b in bullets:
        line = escape(b.text or "")
        labels: list[str] = []
        for cid in b.citation_chunk_ids:
            lab = cite_labels.get(cid)
            if lab:
                labels.append(lab)
        if labels:
            suffix = " <i>(" + escape(", ".join(labels)) + ")</i>"
            line = line + suffix
        items.append(ListItem(Paragraph(line, body_style), leftIndent=18, bulletDedent=6))
    return items


def build_report_pdf(report: ReportResponse) -> bytes:
    """Full report: product, supplier screening, regulatory section and sources."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=12,
        textColor=colors.HexColor("#111111"),
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#222222"),
    )
    h3 = ParagraphStyle(
        "H3",
        parent=styles["Heading3"],
        fontSize=10,
        spaceBefore=8,
        spaceAfter=4,
        textColor=colors.HexColor("#333333"),
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        spaceAfter=6,
    )
    small = ParagraphStyle(
        "Small",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        spaceAfter=4,
        textColor=colors.HexColor("#444444"),
    )

    story: list = []
    story.append(Paragraph(escape("Clearpath — Compliance Report"), title))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph("<b>Product description</b>", h2))
    story.append(_para(report.product_description[:8000], body))

    story.append(Paragraph("<b>Section 1 — Supplier screening</b>", h2))
    story.append(
        Paragraph("<i>Sorted by risk: flagged, then review, then clear.</i>", small),
    )
    for r in _sorted_supplier_risk(report.supplier_risk):
        status = escape(str(r.status))
        name = escape(r.supplier_name or "")
        story.append(Paragraph(f"<b>{name}</b> — <i>{status}</i>", body))
        if r.notes:
            story.append(_para(r.notes, small))
        m = r.match
        if m:
            story.append(
                _para(
                    f"List: {m.source_list}\nMatched name: {m.matched_name}"
                    + (f"\nCountry: {m.country}" if m.country else ""),
                    small,
                )
            )
            if m.aliases:
                story.append(_para("Aliases: " + "; ".join(m.aliases[:40]), small))
        story.append(Spacer(1, 0.05 * inch))

    reg = report.regulatory
    cite_order = [c.chunk_id for c in reg.citations if c.chunk_id]
    cite_labels = {cid: f"Source {i + 1}" for i, cid in enumerate(cite_order)}

    story.append(Paragraph("<b>Section 2 — Regulatory compliance</b>", h2))
    story.append(_para(reg.summary[:12000], body))

    if reg.applicable_regulations:
        story.append(Paragraph("<b>Applicable regulations</b>", h3))
        story.append(
            ListFlowable(
                _bullet_flowables(reg.applicable_regulations, body, cite_labels),
                bulletType="bullet",
                start="•",
            )
        )

    if reg.testing_requirements:
        story.append(Paragraph("<b>Testing requirements</b>", h3))
        story.append(
            ListFlowable(
                _bullet_flowables(reg.testing_requirements, body, cite_labels),
                bulletType="bullet",
                start="•",
            )
        )

    if reg.estimated_compliance_cost_usd is not None or reg.penalty_exposure_note:
        story.append(Paragraph("<b>Cost and enforcement</b>", h3))
        if reg.estimated_compliance_cost_usd is not None:
            story.append(
                _para(
                    f"Estimated compliance cost (USD): {reg.estimated_compliance_cost_usd:,.0f}",
                    body,
                )
            )
        if reg.penalty_exposure_note:
            story.append(_para(reg.penalty_exposure_note, body))

    if reg.citations:
        story.append(Paragraph("<b>Sources</b>", h3))
        for i, c in enumerate(reg.citations, 1):
            line = f"{i}. {c.title}"
            if c.cfr_citation:
                line += f" (CFR: {c.cfr_citation})"
            story.append(_para(line, small))

    doc.build(story)
    buf.seek(0)
    return buf.read()
