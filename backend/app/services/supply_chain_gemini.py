"""
Supply chain stage inference (additive to POST /report).

Runs after Section 1 sanctions screening: one Gemini call with product, supplier names,
roles, and sanctions statuses. Does not modify sanctions or RAG logic.
"""

from __future__ import annotations

import json
import logging
import re

from app.config import Settings, get_settings
from app.schemas.report import (
    SupplierInput,
    SupplierRiskResult,
    SupplyChainAnalysis,
    SupplyChainMappedSupplier,
    SupplyChainStage,
)
from app.services.gemini_generate import generate_text

logger = logging.getLogger(__name__)


def _norm_supplier_key(name: str) -> str:
    return " ".join(str(name).strip().lower().split())


def _stages_timeline_matches(prior: list[SupplyChainStage], candidate: list[SupplyChainStage]) -> bool:
    """True if stage count and each stage_name match in order (timeline is fixed after initial inference)."""
    if len(prior) != len(candidate):
        return False
    return all(p.stage_name == q.stage_name for p, q in zip(prior, candidate, strict=True))


def _authoritative_suppliers_mapped_exactly_once(
    suppliers: list[SupplierInput],
    analysis: SupplyChainAnalysis,
) -> bool:
    expected = {_norm_supplier_key(s.name) for s in suppliers if str(s.name).strip()}
    counts: dict[str, int] = {}
    for st in analysis.stages:
        for m in st.suppliers:
            k = _norm_supplier_key(m.name)
            if not k:
                continue
            counts[k] = counts.get(k, 0) + 1
    if set(counts.keys()) != expected:
        return False
    return all(v == 1 for v in counts.values())


def _unwrap_json_from_model_text(raw: str) -> str:
    """Strip optional ```json fences; Gemini sometimes wraps JSON despite MIME type."""
    t = raw.strip()
    m = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", t, re.IGNORECASE)
    if m:
        inner = m.group(1).strip()
        if inner.startswith("{"):
            return inner
    return t


def _build_screening_payload(
    suppliers: list[SupplierInput],
    supplier_risk: list[SupplierRiskResult],
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for i, s in enumerate(suppliers):
        risk = supplier_risk[i] if i < len(supplier_risk) else None
        status = risk.status if risk else "review"
        rows.append(
            {
                "name": (s.name or "").strip(),
                "role": (s.role or "").strip(),
                "sanctions_status": status,
            },
        )
    return rows


def _parse_supply_chain_json(text: str) -> SupplyChainAnalysis | None:
    text = _unwrap_json_from_model_text(text)
    start = text.find("{")
    if start < 0:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[start:])
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    raw_stages = obj.get("stages")
    if not isinstance(raw_stages, list):
        return None
    stages: list[SupplyChainStage] = []
    for item in raw_stages:
        if not isinstance(item, dict):
            continue
        name = str(item.get("stage_name", "")).strip()
        if not name:
            continue
        status_raw = str(item.get("status", "")).lower().strip()
        if status_raw not in ("ok", "broken", "missing"):
            continue
        note = str(item.get("note", "") or "").strip()
        suppliers_out: list[SupplyChainMappedSupplier] = []
        sups = item.get("suppliers")
        if isinstance(sups, list):
            for s in sups:
                if not isinstance(s, dict):
                    continue
                n = str(s.get("name", "")).strip()
                if not n:
                    continue
                role = str(s.get("role", "") or "").strip()
                st = str(s.get("sanctions_status", "")).lower().strip()
                if st not in ("clear", "review", "flagged"):
                    st = "review"
                suppliers_out.append(
                    SupplyChainMappedSupplier(
                        name=n,
                        role=role,
                        sanctions_status=st,  # validated above
                    ),
                )
        stages.append(
            SupplyChainStage(
                stage_name=name,
                suppliers=suppliers_out,
                status=status_raw,  # validated above
                note=note if status_raw != "ok" else "",
            ),
        )
    if not stages:
        return None
    return SupplyChainAnalysis(stages=stages)


def infer_supply_chain_sync(
    product_description: str,
    suppliers: list[SupplierInput],
    supplier_risk: list[SupplierRiskResult],
    *,
    settings: Settings | None = None,
) -> SupplyChainAnalysis:
    settings = settings or get_settings()
    api_key = (settings.google_api_key or "").strip()
    if not api_key:
        logger.info("Supply chain inference skipped: GOOGLE_API_KEY not set")
        return SupplyChainAnalysis(stages=[])

    screening_rows = _build_screening_payload(suppliers, supplier_risk)
    payload_json = json.dumps(screening_rows, ensure_ascii=False)

    prompt = f"""You analyze **supply chains** for compliance and sourcing context. You receive:
1) A **product description**.
2) A JSON array of suppliers already screened on the **U.S. sanctions list** (Section 1). Each entry has: name, role (what they do), and sanctions_status which is exactly one of: "clear", "review", "flagged".

**Product description:**
{product_description.strip()}

**Suppliers with sanctions status (JSON array — authoritative):**
{payload_json}

Tasks (do all three):
1) Infer the **expected supply chain stages** for this product, ordered from **raw materials / inputs** through **end delivery** to the customer (or retail shelf as appropriate). Use concise stage names (e.g. "Raw materials", "Component manufacturing", "Final assembly", "Distribution").
2) **Map each** of the user's suppliers to **exactly one** stage that best fits their **role** and the product. Every supplier from the array must appear on **exactly one** stage in your output (copy name, role, and sanctions_status from the input).
3) For **each stage**, set **status**:
   - **ok**: the stage has at least one mapped supplier and **none** of them have sanctions_status "review" or "flagged".
   - **broken**: the stage has at least one mapped supplier and **any** of them has sanctions_status "review" or "flagged".
   - **missing**: **no** supplier is mapped to this stage (a gap in coverage). Do **not** suggest specific company names or new suppliers to fill the gap — only note that the stage is unfilled.

For every stage with status **broken** or **missing**, include a short **note** (one or two sentences) explaining the issue. For **ok** stages, use an empty string for **note**.

Return **JSON only** (no markdown), with this exact shape:
{{
  "stages": [
    {{
      "stage_name": "string",
      "suppliers": [
        {{"name": "string", "role": "string", "sanctions_status": "clear"|"review"|"flagged"}}
      ],
      "status": "ok"|"broken"|"missing",
      "note": "string"
    }}
  ]
}}

Rules:
- Include **all** inferred stages in **order** along the chain.
- **Every** supplier from the input array must appear exactly once across all stages.
- Stages with **no** mapped suppliers must have **suppliers**: [] and **status**: "missing" (and a **note** explaining the gap without naming vendors to add).
"""

    try:
        text = generate_text(
            api_key=api_key,
            model=settings.gemini_regulatory_model,
            prompt=prompt,
            temperature=0.2,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Supply chain Gemini call failed")
        return SupplyChainAnalysis(stages=[])

    parsed = _parse_supply_chain_json(text)
    if parsed is None:
        logger.warning("Supply chain response could not be parsed as valid JSON stages")
        return SupplyChainAnalysis(stages=[])

    return parsed


def refactor_supply_chain_sync(
    product_description: str,
    suppliers: list[SupplierInput],
    supplier_risk: list[SupplierRiskResult],
    prior_chain: SupplyChainAnalysis,
    *,
    settings: Settings | None = None,
) -> SupplyChainAnalysis:
    """
    Single Gemini call: remap suppliers across the **existing** timeline only.
    Stage count, order, and stage_name strings must match `prior_chain`; output is validated.
    """
    settings = settings or get_settings()
    api_key = (settings.google_api_key or "").strip()
    if not api_key:
        logger.info("Supply chain refactor skipped: GOOGLE_API_KEY not set")
        return SupplyChainAnalysis(stages=[])

    screening_rows = _build_screening_payload(suppliers, supplier_risk)
    payload_json = json.dumps(screening_rows, ensure_ascii=False)
    prior_json = json.dumps(
        {"stages": [s.model_dump(mode="json") for s in prior_chain.stages]},
        ensure_ascii=False,
    )
    locked_names = [s.stage_name for s in prior_chain.stages]
    locked_layout_json = json.dumps(
        [{"index": i, "stage_name": n} for i, n in enumerate(locked_names)],
        ensure_ascii=False,
    )

    prompt = f"""You analyze **supply chains** for compliance and sourcing context. You receive:
1) A **product description**.
2) A JSON array of suppliers already screened on the **U.S. sanctions list** (Section 1). Each entry has: name, role (what they do), and sanctions_status which is exactly one of: "clear", "review", "flagged". This array is **authoritative** — copy sanctions_status into your output; do not invent or change it.
3) A **current supply chain** snapshot and a **locked timeline**: you must **not** add stages, remove stages, rename stages, or reorder stages. Only **reassign** which suppliers sit in which existing stage and update each stage's **status** and **note**.

**Product description:**
{product_description.strip()}

**Suppliers with sanctions status (JSON array — authoritative):**
{payload_json}

**Locked timeline (exactly this many stages, this order, these exact stage_name strings):**
{locked_layout_json}

**Current supply chain (suppliers per stage before your reassignment):**
{prior_json}

Tasks (do all in **one** JSON response):
1) Output **exactly** {len(locked_names)} stages. Stage `i` must have **stage_name** exactly equal to the locked timeline entry at index `i` (same spelling and order as **Locked timeline**).
2) **Map each** supplier from the authoritative array to **exactly one** stage (copy name, role, and sanctions_status from the input).
3) For **each stage**, set **status**:
   - **ok**: at least one mapped supplier and **none** have sanctions_status "review" or "flagged".
   - **broken**: at least one mapped supplier and **any** has "review" or "flagged".
   - **missing**: **no** supplier mapped to this stage. Do **not** suggest specific company names to fill gaps.

For **broken** or **missing** stages, include a short **note**. For **ok** stages, use an empty string for **note**.

Return **JSON only** (no markdown), with this exact shape:
{{
  "stages": [
    {{
      "stage_name": "string",
      "suppliers": [
        {{"name": "string", "role": "string", "sanctions_status": "clear"|"review"|"flagged"}}
      ],
      "status": "ok"|"broken"|"missing",
      "note": "string"
    }}
  ]
}}

Rules:
- The **stages** array length must be **exactly** {len(locked_names)}; **stage_name** values must match the locked timeline **in order** character-for-character.
- **Every** supplier from the authoritative input array must appear **exactly once** across all stages.
- Do **not** introduce suppliers not in the authoritative array.
"""

    try:
        text = generate_text(
            api_key=api_key,
            model=settings.gemini_regulatory_model,
            prompt=prompt,
            temperature=0.2,
            max_output_tokens=4096,
            response_mime_type="application/json",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Supply chain refactor Gemini call failed")
        return SupplyChainAnalysis(stages=[])

    parsed = _parse_supply_chain_json(text)
    if parsed is None:
        logger.warning("Supply chain refactor response could not be parsed as valid JSON stages")
        return SupplyChainAnalysis(stages=[])

    if not _stages_timeline_matches(prior_chain.stages, parsed.stages):
        logger.warning(
            "Supply chain refactor rejected: timeline stage count or stage_name order/spelling changed",
        )
        return SupplyChainAnalysis(stages=[])

    if not _authoritative_suppliers_mapped_exactly_once(suppliers, parsed):
        logger.warning("Supply chain refactor rejected: authoritative suppliers not mapped exactly once")
        return SupplyChainAnalysis(stages=[])

    return parsed
