"""Supply Chain Sentinel: Chroma-backed profiles + Gemini what-if (sync + stream)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.schemas.sentinel import (
    AddCategoryBody,
    AddHtsBody,
    AddSupplierBody,
    CreateProfileBody,
    ProfileSummary,
    SimulateStreamBody,
    SimulateSyncBody,
    SupplyProfile,
)
from app.services.regulatory_paths import resolve_under_backend
from app.services.sentinel_profiles_chroma import (
    add_category,
    add_hts,
    add_supplier,
    create_profile,
    get_profile,
    list_profile_summaries,
    profile_to_context,
)
from app.services.sentinel_simulation import (
    build_json_only_simulation_prompt,
    build_streaming_simulation_prompt,
    iter_simulation_stream,
    parse_simulation_json,
    split_stream_buffer,
)
from app.services.gemini_generate import generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sentinel", tags=["sentinel"])


def _persist(settings: Settings) -> str:
    return resolve_under_backend(settings.sentinel_chroma_path)


@router.get("/profiles", response_model=list[ProfileSummary])
async def profiles_list() -> list[ProfileSummary]:
    return list_profile_summaries(_persist(get_settings()))


@router.post("/profiles", response_model=SupplyProfile)
async def profiles_create(body: CreateProfileBody) -> SupplyProfile:
    return create_profile(_persist(get_settings()), body)


@router.get("/profiles/{profile_id}", response_model=SupplyProfile)
async def profiles_get(profile_id: str) -> SupplyProfile:
    p = get_profile(_persist(get_settings()), profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.post("/profiles/{profile_id}/suppliers", response_model=SupplyProfile)
async def profiles_add_supplier(profile_id: str, body: AddSupplierBody) -> SupplyProfile:
    p = add_supplier(_persist(get_settings()), profile_id, body)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.post("/profiles/{profile_id}/hts", response_model=SupplyProfile)
async def profiles_add_hts(profile_id: str, body: AddHtsBody) -> SupplyProfile:
    p = add_hts(_persist(get_settings()), profile_id, body)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.post("/profiles/{profile_id}/categories", response_model=SupplyProfile)
async def profiles_add_category(profile_id: str, body: AddCategoryBody) -> SupplyProfile:
    p = add_category(_persist(get_settings()), profile_id, body)
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    return p


@router.post("/simulate")
async def simulate_sync(body: SimulateSyncBody) -> dict[str, Any]:
    settings = get_settings()
    key = (settings.google_api_key or "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY is not configured on the API server.")
    ctx: dict[str, Any]
    if body.profile is not None:
        ctx = body.profile.model_dump()
    elif body.profile_id:
        p = get_profile(_persist(settings), body.profile_id)
        if not p:
            raise HTTPException(status_code=404, detail="Profile not found")
        ctx = profile_to_context(p)
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'profile' (inline baseline) or 'profileId' (saved profile).",
        )
    prompt = build_json_only_simulation_prompt(body.event.strip(), ctx)
    try:
        text = generate_text(
            api_key=key,
            model=settings.gemini_simulation_model,
            prompt=prompt,
            temperature=0.2,
            max_output_tokens=8192,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Gemini simulation failed")
        raise HTTPException(status_code=502, detail="Simulation request failed.") from None
    parsed = parse_simulation_json(text)
    if not parsed:
        raise HTTPException(status_code=502, detail="Model returned invalid simulation JSON.")
    return parsed


def _stream_gen(settings: Settings, prompt: str):
    key = (settings.google_api_key or "").strip()
    try:
        for piece in iter_simulation_stream(
            api_key=key,
            model=settings.gemini_simulation_model,
            prompt=prompt,
        ):
            yield piece
    except Exception as e:  # noqa: BLE001
        logger.exception("Simulation stream failed")
        yield f"\n\n[STREAM_ERROR]{e!s}"


@router.post("/simulate/stream")
async def simulate_stream(body: SimulateStreamBody) -> StreamingResponse:
    settings = get_settings()
    key = (settings.google_api_key or "").strip()
    if not key:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY is not configured on the API server.")
    ctx = {
        "profileName": body.profile.profileName,
        "suppliers": body.profile.suppliers,
        "htsCodes": body.profile.htsCodes,
        "categories": body.profile.categories,
    }
    prompt = build_streaming_simulation_prompt(body.event.strip(), ctx)
    return StreamingResponse(
        _stream_gen(settings, prompt),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-store"},
    )
