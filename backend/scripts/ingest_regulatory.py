#!/usr/bin/env python3
"""
One-time / repeatable ingest: PDFs under data/regulatory_pdfs/ → extract (PyMuPDF) →
chunk → embed (sentence-transformers all-MiniLM-L6-v2) → persist ChromaDB at data/chroma/.

Run from backend directory:
  python -m scripts.ingest_regulatory

Add FDA, CPSC, FTC guidance PDFs to data/regulatory_pdfs/ before running.
"""

from pathlib import Path

# Scaffold only — implement chunking, metadata (title, agency, CFR refs), and collection create.
REGULATORY_DIR = Path(__file__).resolve().parent.parent / "data" / "regulatory_pdfs"
CHROMA_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma"


def main() -> None:
    REGULATORY_DIR.mkdir(parents=True, exist_ok=True)
    CHROMA_DIR.mkdir(parents=True, exist_ok=True)
    pdfs = list(REGULATORY_DIR.glob("*.pdf"))
    print(f"Found {len(pdfs)} PDF(s) in {REGULATORY_DIR}")
    print("Implement: PyMuPDF text extract, split, embed, chromadb.PersistentClient.")


if __name__ == "__main__":
    main()
