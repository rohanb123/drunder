"""
Recompute a single supply-chain stage after the user edits mapped suppliers.

Uses the same ok / broken / missing rules as supply-chain inference. Sanctions status
for each row comes from an explicit override, or from Section 1 supplier_risk name match,
or defaults to review for unknown names.
"""

from __future__ import annotations

from app.schemas.report import (
    SanctionsStatusForChain,
    SupplierRiskResult,
    SupplyChainAnalysis,
    SupplyChainMappedSupplier,
    SupplyChainStage,
    SupplyChainStageStatus,
)


def _norm_name(s: str) -> str:
    return " ".join(str(s).strip().lower().split())


def resolve_sanctions_status(name: str, supplier_risk: list[SupplierRiskResult]) -> SanctionsStatusForChain:
    key = _norm_name(name)
    if not key:
        return "review"
    for r in supplier_risk:
        if _norm_name(r.supplier_name) == key:
            return r.status
    return "review"


def recompute_stage_status_note(suppliers: list[SupplyChainMappedSupplier]) -> tuple[SupplyChainStageStatus, str]:
    if not suppliers:
        return "missing", "No supplier mapped to this stage."
    risky = [s for s in suppliers if s.sanctions_status in ("review", "flagged")]
    if risky:
        flagged_names = [s.name for s in risky if s.sanctions_status == "flagged"]
        review_names = [s.name for s in risky if s.sanctions_status == "review"]
        parts: list[str] = []
        if flagged_names:
            parts.append("Flagged sanctions matches: " + ", ".join(flagged_names) + ".")
        if review_names:
            parts.append("In review: " + ", ".join(review_names) + ".")
        note = " ".join(parts).strip() or "Sanctions concern on a mapped supplier."
        return "broken", note
    return "ok", ""


def drafts_to_mapped(
    drafts: list[tuple[str, str, SanctionsStatusForChain | None]],
    supplier_risk: list[SupplierRiskResult],
) -> list[SupplyChainMappedSupplier]:
    out: list[SupplyChainMappedSupplier] = []
    for name, role, override in drafts:
        n = name.strip()
        if not n:
            continue
        r = role.strip()
        st: SanctionsStatusForChain = override if override is not None else resolve_sanctions_status(n, supplier_risk)
        out.append(SupplyChainMappedSupplier(name=n, role=r, sanctions_status=st))
    return out


def apply_supply_chain_stage_update(
    analysis: SupplyChainAnalysis,
    stage_index: int,
    drafts: list[tuple[str, str, SanctionsStatusForChain | None]],
    supplier_risk: list[SupplierRiskResult],
) -> SupplyChainAnalysis:
    stages = list(analysis.stages)
    if stage_index < 0 or stage_index >= len(stages):
        msg = f"stage_index out of range (0..{len(stages) - 1})"
        raise ValueError(msg)

    mapped = drafts_to_mapped(drafts, supplier_risk)
    status, note = recompute_stage_status_note(mapped)
    prev = stages[stage_index]
    updated = SupplyChainStage(
        stage_name=prev.stage_name,
        suppliers=mapped,
        status=status,
        note=note,
    )
    stages[stage_index] = updated
    return SupplyChainAnalysis(stages=stages)
