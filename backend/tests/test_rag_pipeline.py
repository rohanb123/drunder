"""Regulatory RAG: retrieval metadata, Chroma query behavior, optional live index check."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.config import get_settings
from app.schemas.report import RegulatorySection
from app.services.regulatory_chroma import RetrievedChunk, query_regulatory_chunks
from app.services.regulatory_gemini import citations_from_chunks
from app.services.regulatory_paths import BACKEND_ROOT, resolve_under_backend

CHROMA_DIR = BACKEND_ROOT / "chroma_db"
COLLECTION = "clearpath_regulatory"


def test_query_regulatory_chunks_missing_dir_returns_empty() -> None:
    missing = Path("/nonexistent/chroma/path/that/does/not/exist")
    out = query_regulatory_chunks(
        "any product",
        chroma_dir=missing,
        collection_name=COLLECTION,
        k=8,
    )
    assert out == []


def test_citations_from_chunks_preserves_metadata() -> None:
    chunks = [
        RetrievedChunk(
            id="abc_1",
            text="sample excerpt",
            metadata={
                "source_agency": "FTC",
                "document_id": "Health-Products-Compliance-Guidance",
                "title": "Health Products",
                "page_start": "3",
                "chunk_index": "0",
            },
        ),
    ]
    cites = citations_from_chunks(chunks)
    assert len(cites) == 1
    assert cites[0].source == "FTC"
    assert cites[0].document_id == "Health-Products-Compliance-Guidance"
    assert cites[0].chunk_id == "abc_1"


@pytest.mark.skipif(not CHROMA_DIR.is_dir(), reason="chroma_db/ not present (run ingest first)")
def test_chroma_collection_has_documents() -> None:
    import chromadb

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    coll = client.get_collection(COLLECTION)
    assert coll.count() > 0


@pytest.mark.skipif(not CHROMA_DIR.is_dir(), reason="chroma_db/ not present (run ingest first)")
def test_query_regulatory_returns_at_most_k_chunks_with_metadata() -> None:
    settings = get_settings()
    chroma_dir = resolve_under_backend(settings.regulatory_chroma_path)
    chunks = query_regulatory_chunks(
        "Organic cotton apparel with environmental claims on hang tags sold in the US.",
        chroma_dir=chroma_dir,
        collection_name=settings.regulatory_collection_name,
        embedding_model_name=settings.regulatory_embedding_model,
        k=8,
    )
    assert 1 <= len(chunks) <= 8
    for c in chunks:
        assert c.id
        assert c.text.strip()
        assert "source_agency" in c.metadata
        assert c.metadata.get("document_id") or c.metadata.get("title")


@patch("app.services.gemini_generate.generate_text")
def test_synthesize_regulatory_section_parses_json(mock_gen: MagicMock) -> None:
    from app.services.regulatory_gemini import synthesize_regulatory_section

    mock_gen.return_value = """{
  "summary": "Test summary grounded in excerpts.",
  "applicable_regulations": ["Rule A"],
  "testing_requirements": ["Test B"],
  "estimated_compliance_cost_usd": null,
  "penalty_exposure_note": null,
  "citations": [
    {
      "title": "Doc",
      "source": "FTC",
      "cfr_citation": null,
      "document_id": "doc1",
      "chunk_id": "chunk-1"
    }
  ]
}"""
    chunks = [
        RetrievedChunk(
            id="chunk-1",
            text="Excerpt text for compliance.",
            metadata={
                "source_agency": "FTC",
                "document_id": "doc1",
                "title": "Doc",
                "page_start": "1",
                "chunk_index": "0",
            },
        ),
    ]
    section = synthesize_regulatory_section(
        "Test product",
        chunks,
        api_key="fake-key",
        model="gemini-2.5-flash-lite",
    )
    assert isinstance(section, RegulatorySection)
    assert "Test summary" in section.summary
    assert section.applicable_regulations == ["Rule A"]
    assert len(section.citations) >= 1
    assert section.citations[0].chunk_id == "chunk-1"


@pytest.mark.skipif(not CHROMA_DIR.is_dir(), reason="chroma_db/ not present")
@pytest.mark.skipif(
    not (get_settings().google_api_key or "").strip(),
    reason="GOOGLE_API_KEY not set (optional live Gemini check)",
)
def test_live_regulatory_rag_returns_section() -> None:
    """One end-to-end call: Chroma + real Gemini (uses quota; skipped without key)."""
    from app.services.regulatory import _run_regulatory_rag_sync

    section = _run_regulatory_rag_sync(
        "Vitamin D supplement capsules with structure/function claims, US market.",
    )
    assert isinstance(section, RegulatorySection)
    assert section.citations, "expected citations from Chroma"
    assert len(section.citations) <= 8
    assert section.summary.strip()
