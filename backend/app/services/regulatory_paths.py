"""Resolve backend-rooted paths for regulatory data and Chroma persistence."""

from pathlib import Path

# backend/app/services/this_file -> backend
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def resolve_under_backend(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else (BACKEND_ROOT / p)
