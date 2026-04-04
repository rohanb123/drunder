#!/usr/bin/env python3
"""
One-time / repeatable ingest: FDA, CPSC, and FTC PDFs under data/regulatory_pdfs/

- PyMuPDF extracts text per page; text is chunked and embedded with sentence-transformers
  (all-MiniLM-L6-v2 by default).
- Vectors + citation metadata persist in local ChromaDB (chroma_db/ at backend root).

Layout (recommended):
  data/regulatory_pdfs/fda/*.pdf
  data/regulatory_pdfs/cpsc/*.pdf
  data/regulatory_pdfs/ftc/*.pdf

Run from the backend directory:
  pip install -r requirements.txt
  python -m scripts.ingest_regulatory
  python -m scripts.ingest_regulatory --reset   # drop and rebuild the collection
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Allow `python -m scripts.ingest_regulatory` with app on path
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.config import get_settings  # noqa: E402
from app.services.regulatory_chroma import run_regulatory_ingest  # noqa: E402
from app.services.regulatory_paths import resolve_under_backend  # noqa: E402


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    parser = argparse.ArgumentParser(description="Ingest regulatory PDFs into local ChromaDB.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete the existing collection before re-indexing.",
    )
    args = parser.parse_args()

    settings = get_settings()
    pdf_root = resolve_under_backend(settings.regulatory_pdfs_path)
    chroma_dir = resolve_under_backend(settings.regulatory_chroma_path)

    pdf_root.mkdir(parents=True, exist_ok=True)
    pdfs = list(pdf_root.rglob("*.pdf"))
    print(f"PDF root: {pdf_root} ({len(pdfs)} file(s))")
    print(f"Chroma dir: {chroma_dir}")
    print(f"Collection: {settings.regulatory_collection_name}")

    n = run_regulatory_ingest(
        pdf_root,
        chroma_dir,
        settings.regulatory_collection_name,
        embedding_model_name=settings.regulatory_embedding_model,
        reset_collection=args.reset,
    )
    print(f"Ingested {n} chunk(s).")


if __name__ == "__main__":
    main()
