"""PDF text extraction (PyMuPDF), token chunking, and metadata for regulatory RAG."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF

# Match all-MiniLM-L6-v2 context (~512); overlap preserves continuity at boundaries.
_CHUNK_TOKENS = 500
_OVERLAP_TOKENS = 50
_MIN_CHUNK_TOKENS = 24

_AGENCY_ALIASES = {"fda", "cpsc", "ftc"}


def load_embedding_tokenizer(model_name: str = "all-MiniLM-L6-v2"):
    """Tokenizer aligned with sentence-transformers embedding model (for token-sized chunks)."""
    from transformers import AutoTokenizer

    tid = model_name if "/" in model_name else f"sentence-transformers/{model_name}"
    return AutoTokenizer.from_pretrained(tid)


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


def _build_page_boundaries(pages: list[tuple[int, str]]) -> tuple[str, list[tuple[int, int, int]]]:
    """Full document text and [(char_start, char_end, page_num), ...] per page body."""
    parts: list[str] = []
    boundaries: list[tuple[int, int, int]] = []
    pos = 0
    first = True
    for page_num, raw in pages:
        text = (raw or "").strip()
        if not text:
            continue
        if not first:
            sep = "\n\n"
            parts.append(sep)
            pos += len(sep)
        first = False
        start = pos
        parts.append(text)
        pos += len(text)
        boundaries.append((start, pos, page_num))
    return ("".join(parts), boundaries)


def _pages_touching_range(boundaries: list[tuple[int, int, int]], c0: int, c1: int) -> tuple[int, int]:
    pages: list[int] = []
    for start, end, page in boundaries:
        if end > c0 and start < c1:
            pages.append(page)
    if not pages:
        return (1, 1)
    return (min(pages), max(pages))


def chunk_document_tokens(
    full_text: str,
    boundaries: list[tuple[int, int, int]],
    tokenizer,
    *,
    chunk_tokens: int = _CHUNK_TOKENS,
    overlap_tokens: int = _OVERLAP_TOKENS,
    min_tokens: int = _MIN_CHUNK_TOKENS,
) -> list[tuple[str, int, int]]:
    """Sliding token windows over the full document; returns (chunk_text, page_start, page_end)."""
    if not full_text.strip():
        return []
    enc = tokenizer(
        full_text,
        return_offsets_mapping=True,
        add_special_tokens=False,
        truncation=False,
    )
    input_ids: list[int] = enc["input_ids"]
    offsets: list[tuple[int, int]] = enc["offset_mapping"]
    if not input_ids or len(input_ids) != len(offsets):
        return []

    step = max(chunk_tokens - overlap_tokens, 1)
    out: list[tuple[str, int, int]] = []

    # Short documents: one chunk even if below min_tokens (still fits the embedder's max length).
    if len(input_ids) < min_tokens:
        window_ids = input_ids
        window_offsets = offsets
        c0 = window_offsets[0][0]
        c1 = window_offsets[-1][1]
        p0, p1 = _pages_touching_range(boundaries, c0, c1)
        chunk_text = tokenizer.decode(window_ids, skip_special_tokens=True).strip()
        if len(chunk_text) >= 8:
            out.append((chunk_text, p0, p1))
        return out

    i = 0
    while i < len(input_ids):
        window_ids = input_ids[i : i + chunk_tokens]
        if len(window_ids) < min_tokens:
            break
        window_offsets = offsets[i : i + chunk_tokens]
        c0 = window_offsets[0][0]
        c1 = window_offsets[-1][1]
        p0, p1 = _pages_touching_range(boundaries, c0, c1)
        chunk_text = tokenizer.decode(window_ids, skip_special_tokens=True).strip()
        if len(chunk_text) >= 20:
            out.append((chunk_text, p0, p1))
        i += step
    return out


def pdf_to_chunks(
    pdf_path: Path,
    regulatory_root: Path,
    tokenizer,
    *,
    chunk_tokens: int = _CHUNK_TOKENS,
    overlap_tokens: int = _OVERLAP_TOKENS,
) -> list[tuple[str, dict[str, Any]]]:
    """
    Extract PDF text, chunk by embedding-model tokens with overlap, attach citation metadata.
    """
    agency = infer_agency(pdf_path, regulatory_root)
    document_name = pdf_path.name
    doc_id = pdf_path.stem
    title = pdf_path.stem.replace("_", " ")
    cfr_guess = guess_cfr_from_filename(pdf_path.stem)
    rel = str(pdf_path.resolve().relative_to(regulatory_root.resolve()))

    pages = extract_pdf_pages(pdf_path)
    full_text, boundaries = _build_page_boundaries(pages)
    if not full_text.strip():
        return []

    spans = chunk_document_tokens(
        full_text,
        boundaries,
        tokenizer,
        chunk_tokens=chunk_tokens,
        overlap_tokens=overlap_tokens,
    )
    rows: list[tuple[str, dict[str, Any]]] = []
    for chunk_idx, (part, p0, p1) in enumerate(spans):
        meta = {
            "source_agency": agency,
            "document_name": document_name[:500],
            "document_id": doc_id,
            "title": title[:500],
            "source_file": rel[:500],
            "page_start": str(p0),
            "page_end": str(p1),
            "chunk_index": str(chunk_idx),
            "cfr_citation": (cfr_guess or "")[:200],
        }
        rows.append((part, meta))
    return rows
