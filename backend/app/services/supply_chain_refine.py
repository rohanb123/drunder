"""
Refine supply chain after the user edits suppliers on one stage.

1) Run Section 1 sanctions screening (Trade.gov + existing logic) on the edited stage's suppliers.
2) Merge results into the chain snapshot.
3) If GOOGLE_API_KEY is set, one Gemini call refactors the full chain (same JSON shape as inference).
   Otherwise return the merged snapshot with deterministic stage status on the edited stage only.
"""

from __future__ import annotations

import json
import logging

from app.schemas.report import (
    SanctionsStatusForChain,
    SupplierInput,
    SupplierRiskResult,
    SupplyChainAnalysis,
    SupplyChainMappedSupplier,
    SupplyChainStage,
    SupplyChainStageUpdateRequest,
)
from app.services.sanctions import run_supplier_screening
from app.services.supply_chain_gemini import refactor_supply_chain_sync
from app.services.supply_chain_update import recompute_stage_status_note

logger = logging.getLogger(__name__)


def _norm_name(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def _merge_edited_stage_suppliers(
    stages: list[SupplyChainStage],
    stage_index: int,
    screened_pairs: list[tuple[str, str, SanctionsStatusForChain]],
) -> list[SupplyChainStage]:
    """screened_pairs: (name, role, sanctions_status)."""
    out = [s.model_copy(deep=True) for s in stages]
    if stage_index < 0 or stage_index >= len(out):
        return out
    prev = out[stage_index]
    mapped = [
        SupplyChainMappedSupplier(name=n.strip(), role=r.strip(), sanctions_status=st)
        for n, r, st in screened_pairs
        if n.strip()
    ]
    st, note = recompute_stage_status_note(mapped)
    out[stage_index] = SupplyChainStage(
        stage_name=prev.stage_name,
        suppliers=mapped,
        status=st,
        note=note,
    )
    return out


def flatten_chain_to_screening_inputs(
    stages: list[SupplyChainStage],
) -> tuple[list[SupplierInput], list[SupplierRiskResult]]:
    """
    Unique suppliers by normalized name (first occurrence wins), stage order preserved.
    """
    seen: set[str] = set()
    inputs: list[SupplierInput] = []
    risk: list[SupplierRiskResult] = []
    for st in stages:
        for m in st.suppliers:
            key = _norm_name(m.name)
            if not key or key in seen:
                continue
            seen.add(key)
            role = (m.role or "").strip() or "Unspecified"
            inputs.append(SupplierInput(name=m.name.strip(), role=role))
            risk.append(
                SupplierRiskResult(
                    supplier_name=m.name.strip(),
                    status=m.sanctions_status,
                    match=None,
                    fuzzy_score=None,
                    notes=None,
                    role=role,
                ),
            )
    return inputs, risk


async def refine_supply_chain_after_stage_edit(body: SupplyChainStageUpdateRequest) -> SupplyChainAnalysis:
    if body.stage_index >= len(body.stages):
        msg = f"stage_index {body.stage_index} is out of range for {len(body.stages)} stage(s)"
        raise ValueError(msg)

    pairs: list[tuple[str, str]] = []
    for d in body.suppliers:
        n = (d.name or "").strip()
        if not n:
            continue
        r = (d.role or "").strip() or "Unspecified"
        pairs.append((n, r))

    screened_triples: list[tuple[str, str, SanctionsStatusForChain]] = []
    if pairs:
        inputs = [SupplierInput(name=n, role=r) for n, r in pairs]
        fresh = await run_supplier_screening(inputs)
        for i, (n, r) in enumerate(pairs):
            status: SanctionsStatusForChain = fresh[i].status if i < len(fresh) else "review"
            screened_triples.append((n, r, status))

    merged_stages = _merge_edited_stage_suppliers(body.stages, body.stage_index, screened_triples)
    merged_analysis = SupplyChainAnalysis(stages=merged_stages)

    uni_in, uni_risk = flatten_chain_to_screening_inputs(merged_stages)
    if not uni_in:
        return merged_analysis

    refactored = refactor_supply_chain_sync(
        body.product_description,
        uni_in,
        uni_risk,
        merged_analysis,
    )
    if refactored.stages:
        return refactored

    logger.warning("Supply chain refactor returned no stages; using merged snapshot after screening")
    return merged_analysis
