"""PDF text extraction (PyMuPDF), chunking, and metadata for regulatory RAG."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

# Character-based chunks; guidance PDFs are often dense — ~900 chars with overlap.
_CHUNK_CHARS = 900
_CHUNK_OVERLAP = 120

_AGENCY_ALIASES = {"fda", "cpsc", "ftc"}


def chunk_text(text: str, chunk_size: int = _CHUNK_CHARS, overlap: int = _CHUNK_OVERLAP) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    step = max(chunk_size - overlap, 1)
    for i in range(0, len(cleaned), step):
        piece = cleaned[i : i + chunk_size].strip()
        if len(piece) >= 40:
            chunks.append(piece)
    return chunks


def extract_pdf_pages(pdf_path: Path) -> list[tuple[int, str]]:
    doc = fitz.open(pdf_path)
    try:
        out: list[tuple[int, str]] = []
        for i in range(len(doc)):
            page = doc[i]
            txt = page.get_text("text") or ""
            out.append((i + 1, txt))
        return out
    finally:
        doc.close()


def infer_agency(pdf_path: Path, regulatory_root: Path) -> str:
    try:
        rel = pdf_path.resolve().relative_to(regulatory_root.resolve())
        if rel.parts:
            top = rel.parts[0].lower()
            if top in _AGENCY_ALIASES:
                return top.upper()
    except ValueError:
        pass
    return "GENERAL"


def guess_cfr_from_filename(stem: str) -> str | None:
    """Light heuristic: e.g. '16-CFR-1303' or '21CFR110'."""
    m = re.search(
        r"(?P<cfr>\d{1,2}\s*CFR\s*[\d.]+|\d{2}\s*CFR\s*Part\s*\d+)",
        stem,
        re.IGNORECASE,
    )
    if m:
        return re.sub(r"\s+", " ", m.group("cfr").strip())
    return None


def pdf_to_chunks(
    pdf_path: Path,
    regulatory_root: Path,
) -> list[tuple[str, dict[str, Any]]]:
    """
    Returns list of (chunk_text, metadata) with string values suitable for ChromaDB.
    """
    agency = infer_agency(pdf_path, regulatory_root)
    doc_id = pdf_path.stem
    title = pdf_path.stem.replace("_", " ")
    cfr_guess = guess_cfr_from_filename(pdf_path.stem)
    rel = str(pdf_path.resolve().relative_to(regulatory_root.resolve()))

    rows: list[tuple[str, dict[str, Any]]] = []
    pages = extract_pdf_pages(pdf_path)
    chunk_idx = 0
    for page_num, page_text in pages:
        for part in chunk_text(page_text):
            meta = {
                "source_agency": agency,
                "document_id": doc_id,
                "title": title[:500],
                "source_file": rel[:500],
                "page_start": str(page_num),
                "chunk_index": str(chunk_idx),
                "cfr_citation": (cfr_guess or "")[:200],
            }
            rows.append((part, meta))
            chunk_idx += 1
    return rows
