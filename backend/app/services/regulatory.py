"""
Section 3 — Regulatory RAG: local ChromaDB + sentence-transformers + Gemini synthesis.

Setup (once): `python -m scripts.ingest_regulatory` after placing PDFs under data/regulatory_pdfs/.
"""

from __future__ import annotations

import asyncio

from app.config import get_settings
from app.schemas.report import RegulatorySection
from app.services.regulatory_chroma import query_regulatory_chunks
from app.services.regulatory_gemini import citations_from_chunks, synthesize_regulatory_section
from app.services.regulatory_paths import resolve_under_backend


def _run_regulatory_rag_sync(product_description: str) -> RegulatorySection:
    settings = get_settings()
    chroma_dir = resolve_under_backend(settings.regulatory_chroma_path)

    chunks = query_regulatory_chunks(
        product_description.strip(),
        chroma_dir=chroma_dir,
        collection_name=settings.regulatory_collection_name,
        embedding_model_name=settings.regulatory_embedding_model,
        k=8,
    )

    gkey = (settings.google_api_key or "").strip()
    if not gkey:
        if not chunks:
            return synthesize_regulatory_section(product_description, [], api_key="")
        return RegulatorySection(
            summary=(
                "Retrieved top guidance excerpts from the local index, but GOOGLE_API_KEY is not set; "
                "Gemini synthesis is skipped. Use citations below (from chunk metadata)."
            ),
            applicable_regulations=[],
            testing_requirements=[],
            estimated_compliance_cost_usd=None,
            penalty_exposure_note=None,
            citations=citations_from_chunks(chunks),
        )

    return synthesize_regulatory_section(
        product_description,
        chunks,
        api_key=gkey,
        model=settings.gemini_regulatory_model,
    )


async def run_regulatory_rag(product_description: str) -> RegulatorySection:
    """Embed query → Chroma top-8 → Gemini structured section (sync work off the event loop)."""
    return await asyncio.to_thread(_run_regulatory_rag_sync, product_description)
