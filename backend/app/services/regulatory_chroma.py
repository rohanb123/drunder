"""Local ChromaDB persistence and retrieval for regulatory guidance chunks."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import chromadb

from app.services.regulatory_index import pdf_to_chunks

EMBEDDING_MODEL_DEFAULT = "all-MiniLM-L6-v2"


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    text: str
    metadata: dict[str, str]


@lru_cache(maxsize=1)
def _get_sentence_transformer(model_name: str):
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(model_name)


def _get_collection(client: chromadb.PersistentClient, name: str) -> Any:
    try:
        return client.get_collection(name)
    except Exception:
        return None


def query_regulatory_chunks(
    product_description: str,
    *,
    chroma_dir: Path,
    collection_name: str,
    embedding_model_name: str = EMBEDDING_MODEL_DEFAULT,
    k: int = 8,
) -> list[RetrievedChunk]:
    """Embed the product description and return the top-k chunks with metadata."""
    chroma_dir = Path(chroma_dir)
    if not chroma_dir.is_dir():
        return []

    client = chromadb.PersistentClient(path=str(chroma_dir))
    coll = _get_collection(client, collection_name)
    if coll is None or coll.count() == 0:
        return []

    model = _get_sentence_transformer(embedding_model_name)
    q_emb = model.encode([product_description.strip()]).tolist()
    raw = coll.query(query_embeddings=q_emb, n_results=min(k, coll.count()), include=["documents", "metadatas"])

    ids = raw.get("ids") or []
    docs = raw.get("documents") or []
    metas = raw.get("metadatas") or []
    if not ids or not ids[0]:
        return []

    out: list[RetrievedChunk] = []
    for i, cid in enumerate(ids[0]):
        text = (docs[0][i] if docs and docs[0] and i < len(docs[0]) else "") or ""
        md = metas[0][i] if metas and metas[0] and i < len(metas[0]) else {}
        flat: dict[str, str] = {str(k): str(v) if v is not None else "" for k, v in (md or {}).items()}
        out.append(RetrievedChunk(id=str(cid), text=text, metadata=flat))
    return out


def _stable_chunk_id(rel_key: str, doc_id: str, page: str, chunk_index: str) -> str:
    h = hashlib.sha256(rel_key.encode()).hexdigest()[:10]
    raw = f"{h}_{doc_id}_{page}_{chunk_index}"
    return raw[:512]


def run_regulatory_ingest(
    pdf_root: Path,
    chroma_dir: Path,
    collection_name: str,
    *,
    embedding_model_name: str = EMBEDDING_MODEL_DEFAULT,
    reset_collection: bool = False,
) -> int:
    """
    Extract all PDFs under pdf_root, chunk, embed, write to Chroma. Returns chunk count.
    """
    pdf_root = pdf_root.resolve()
    chroma_dir = Path(chroma_dir)
    chroma_dir.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(chroma_dir))
    if reset_collection:
        try:
            client.delete_collection(collection_name)
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"},
    )

    all_ids: list[str] = []
    all_docs: list[str] = []
    all_meta: list[dict[str, Any]] = []

    pdfs = sorted(pdf_root.rglob("*.pdf"))
    for pdf_path in pdfs:
        try:
            rel = str(pdf_path.resolve().relative_to(pdf_root))
        except ValueError:
            rel = pdf_path.name
        for text, meta in pdf_to_chunks(pdf_path, pdf_root):
            cid = _stable_chunk_id(rel, meta["document_id"], meta["page_start"], meta["chunk_index"])
            meta_str = {k: str(v) if v is not None else "" for k, v in meta.items()}
            all_ids.append(cid)
            all_docs.append(text)
            all_meta.append(meta_str)

    if not all_ids:
        return 0

    model = _get_sentence_transformer(embedding_model_name)
    batch_size = 32
    for start in range(0, len(all_ids), batch_size):
        end = start + batch_size
        b_ids = all_ids[start:end]
        b_docs = all_docs[start:end]
        b_meta = all_meta[start:end]
        b_emb = model.encode(b_docs, convert_to_numpy=True).tolist()
        collection.upsert(ids=b_ids, documents=b_docs, metadatas=b_meta, embeddings=b_emb)

    return len(all_ids)
