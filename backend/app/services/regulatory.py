"""
Section 3 — Regulatory compliance (children's products scope).

Flow (to implement): ingest FDA/CPSC/FTC PDFs with PyMuPDF → chunk + embed (sentence-transformers)
into ChromaDB → retrieve top-k → Gemini synthesis with citations from chunk metadata only.
"""

from app.config import get_settings
from app.schemas.report import RegulatoryCitation, RegulatorySection


async def run_regulatory_rag(product_description: str) -> RegulatorySection:
    """
    RAG over local ChromaDB; Gemini reads only retrieved chunks + metadata.

    Stub: empty citations until `scripts/ingest_regulatory.py` has been run and Chroma populated.
    """
    _ = get_settings()
    return RegulatorySection(
        summary=(
            f"Stub regulatory synthesis for: {product_description[:200]!r}… "
            "Run PDF ingest and Chroma indexing; then query + Gemini Flash here."
        ),
        applicable_regulations=[],
        testing_requirements=[],
        estimated_compliance_cost_usd=None,
        penalty_exposure_note=None,
        citations=[
            RegulatoryCitation(
                title="Placeholder — ingest guidance PDFs and store metadata on each chunk",
                source="CPSC",
                document_id=None,
                chunk_id=None,
            )
        ],
    )
