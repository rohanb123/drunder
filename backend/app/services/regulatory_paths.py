"""Resolve backend-rooted paths for regulatory data and Chroma persistence."""

from pathlib import Path

# backend/app/services/this_file -> backend
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_under_backend(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (BACKEND_ROOT / p)


def resolve_regulatory_pdf_safe(pdf_root: Path, relative: str) -> Path | None:
    """
    Resolve a path under pdf_root to an existing .pdf file.
    Rejects traversal (..), absolute paths, and paths outside pdf_root.
    """
    root = pdf_root.resolve()
    rel = relative.strip().replace("\\", "/").lstrip("/")
    if not rel or "\x00" in rel:
        return None
    parts = Path(rel).parts
    if ".." in parts or parts[0] == "/":
        return None
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.suffix.lower() != ".pdf" or not candidate.is_file():
        return None
    return candidate
