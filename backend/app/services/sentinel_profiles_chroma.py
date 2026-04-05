"""Persist supply-chain profiles in a dedicated ChromaDB collection (replaces Convex tables)."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

from app.schemas.sentinel import (
    AddCategoryBody,
    AddHtsBody,
    AddSupplierBody,
    CategoryRow,
    CreateProfileBody,
    HtsRow,
    ProfileSummary,
    SupplierRow,
    SupplyProfile,
)


def _collection(persist_path: str):
    client = chromadb.PersistentClient(path=persist_path)
    ef = embedding_functions.DefaultEmbeddingFunction()
    return client.get_or_create_collection(name="supply_profiles", embedding_function=ef)


def _now_ms() -> int:
    return int(time.time() * 1000)


def list_profile_summaries(persist_path: str) -> list[ProfileSummary]:
    coll = _collection(persist_path)
    data = coll.get(include=["metadatas", "documents"])
    out: list[ProfileSummary] = []
    for i, pid in enumerate(data["ids"]):
        doc = json.loads(data["documents"][i])
        out.append(ProfileSummary(id=pid, name=doc.get("name", ""), updatedAt=int(doc.get("updatedAt", 0))))
    out.sort(key=lambda x: -x.updatedAt)
    return out


def get_profile(persist_path: str, profile_id: str) -> SupplyProfile | None:
    coll = _collection(persist_path)
    r = coll.get(ids=[profile_id], include=["documents"])
    if not r["ids"]:
        return None
    doc = json.loads(r["documents"][0])
    return SupplyProfile.model_validate(doc)


def _upsert(persist_path: str, profile: dict[str, Any]) -> None:
    coll = _collection(persist_path)
    pid = profile["id"]
    payload = json.dumps(profile, ensure_ascii=False)
    coll.upsert(
        ids=[pid],
        documents=[payload],
        metadatas=[{"name": profile.get("name", ""), "updated_at": int(profile.get("updatedAt", 0))}],
    )


def create_profile(persist_path: str, body: CreateProfileBody) -> SupplyProfile:
    pid = str(uuid.uuid4())
    profile: dict[str, Any] = {
        "id": pid,
        "name": body.name.strip(),
        "updatedAt": _now_ms(),
        "suppliers": [],
        "htsCodes": [],
        "categories": [],
    }
    _upsert(persist_path, profile)
    return SupplyProfile.model_validate(profile)


def add_supplier(persist_path: str, profile_id: str, body: AddSupplierBody) -> SupplyProfile | None:
    p = get_profile(persist_path, profile_id)
    if not p:
        return None
    row = SupplierRow(id=str(uuid.uuid4()), name=body.name.strip(), country=body.country.strip().upper())
    d = p.model_dump()
    d["suppliers"].append(row.model_dump())
    d["updatedAt"] = _now_ms()
    _upsert(persist_path, d)
    return SupplyProfile.model_validate(d)


def add_hts(persist_path: str, profile_id: str, body: AddHtsBody) -> SupplyProfile | None:
    p = get_profile(persist_path, profile_id)
    if not p:
        return None
    row = HtsRow(code=body.code.strip(), description=body.description.strip() if body.description else None)
    d = p.model_dump()
    d["htsCodes"].append(row.model_dump())
    d["updatedAt"] = _now_ms()
    _upsert(persist_path, d)
    return SupplyProfile.model_validate(d)


def add_category(persist_path: str, profile_id: str, body: AddCategoryBody) -> SupplyProfile | None:
    p = get_profile(persist_path, profile_id)
    if not p:
        return None
    row = CategoryRow(name=body.name.strip())
    d = p.model_dump()
    d["categories"].append(row.model_dump())
    d["updatedAt"] = _now_ms()
    _upsert(persist_path, d)
    return SupplyProfile.model_validate(d)


def profile_to_context(p: SupplyProfile) -> dict[str, Any]:
    return {
        "profileName": p.name,
        "suppliers": [{"name": s.name, "country": s.country} for s in p.suppliers],
        "htsCodes": [{"code": h.code, "description": h.description} for h in p.htsCodes],
        "categories": [{"name": c.name} for c in p.categories],
    }
