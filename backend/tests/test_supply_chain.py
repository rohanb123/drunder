"""Supply chain Gemini add-on: parsing and orchestration wiring (mocked LLM)."""

import asyncio
from unittest.mock import patch

from app.schemas.report import (
    RegulatorySection,
    SupplierInput,
    SupplierRiskResult,
    SupplyChainAnalysis,
    SupplyChainMappedSupplier,
    SupplyChainStage,
    SupplyChainStageUpdateRequest,
    SupplyChainSupplierDraft,
)
from app.services.supply_chain_gemini import _unwrap_json_from_model_text, infer_supply_chain_sync
from app.services.supply_chain_refine import refine_supply_chain_after_stage_edit
from app.services.supply_chain_update import (
    apply_supply_chain_stage_update,
    recompute_stage_status_note,
    resolve_sanctions_status,
)

MOCK_GEMINI_JSON = """
Here's the analysis.
{
  "stages": [
    {
      "stage_name": "Raw materials",
      "suppliers": [
        {"name": "Acme Silicone Co", "role": "raw silicone manufacturer", "sanctions_status": "clear"}
      ],
      "status": "ok",
      "note": ""
    },
    {
      "stage_name": "Packaging",
      "suppliers": [],
      "status": "missing",
      "note": "No supplier is mapped to packaging for this product."
    },
    {
      "stage_name": "Distribution",
      "suppliers": [
        {"name": "Risky Logistics LLC", "role": "freight forwarder", "sanctions_status": "flagged"}
      ],
      "status": "broken",
      "note": "At least one mapped supplier is flagged on sanctions screening."
    }
  ]
}
"""


def _parsed_chain_fixture() -> SupplyChainAnalysis:
    return SupplyChainAnalysis(
        stages=[
            SupplyChainStage(
                stage_name="Assembly",
                suppliers=[],
                status="missing",
                note="Gap.",
            ),
        ],
    )


def test_unwrap_json_strips_markdown_fence():
    raw = '```json\n{"stages": [{"stage_name": "A", "suppliers": [], "status": "missing", "note": "x"}]}\n```'
    out = _unwrap_json_from_model_text(raw)
    assert out.startswith("{")
    assert '"stage_name"' in out


def test_infer_supply_chain_parses_structured_json():
    suppliers = [
        SupplierInput(name="Acme Silicone Co", role="raw silicone manufacturer"),
        SupplierInput(name="Risky Logistics LLC", role="freight forwarder"),
    ]
    risk = [
        SupplierRiskResult(
            supplier_name="Acme Silicone Co",
            status="clear",
            match=None,
            fuzzy_score=None,
            notes=None,
        ),
        SupplierRiskResult(
            supplier_name="Risky Logistics LLC",
            status="flagged",
            match=None,
            fuzzy_score=None,
            notes="test",
        ),
    ]
    with patch("app.services.supply_chain_gemini.generate_text", return_value=MOCK_GEMINI_JSON):
        with patch("app.services.supply_chain_gemini.get_settings") as gs:
            gs.return_value.google_api_key = "fake-key"
            gs.return_value.gemini_regulatory_model = "gemini-2.5-flash-lite"
            out = infer_supply_chain_sync("Organic lip balm sticks", suppliers, risk)

    assert len(out.stages) == 3
    assert out.stages[0].stage_name == "Raw materials"
    assert out.stages[0].status == "ok"
    assert out.stages[0].note == ""
    assert len(out.stages[0].suppliers) == 1
    assert out.stages[0].suppliers[0].sanctions_status == "clear"

    assert out.stages[1].status == "missing"
    assert out.stages[1].suppliers == []

    assert out.stages[2].status == "broken"
    assert out.stages[2].suppliers[0].name == "Risky Logistics LLC"


def test_infer_supply_chain_empty_without_api_key():
    suppliers = [SupplierInput(name="Solo", role="Tier-1 component supplier")]
    risk = [
        SupplierRiskResult(
            supplier_name="Solo",
            status="clear",
            match=None,
            fuzzy_score=None,
            notes=None,
        ),
    ]
    with patch("app.services.supply_chain_gemini.get_settings") as gs:
        gs.return_value.google_api_key = ""
        out = infer_supply_chain_sync("Product", suppliers, risk)
    assert out.stages == []


def test_resolve_sanctions_status_matches_screening():
    risk = [
        SupplierRiskResult(
            supplier_name="  Acme Corp  ",
            status="flagged",
            match=None,
            fuzzy_score=None,
            notes=None,
        ),
    ]
    assert resolve_sanctions_status("acme corp", risk) == "flagged"
    assert resolve_sanctions_status("Unknown LLC", risk) == "review"


def test_recompute_stage_missing_and_ok():
    st, note = recompute_stage_status_note([])
    assert st == "missing"
    assert "No supplier" in note

    st2, note2 = recompute_stage_status_note(
        [SupplyChainMappedSupplier(name="A", role="r", sanctions_status="clear")],
    )
    assert st2 == "ok"
    assert note2 == ""


def test_apply_supply_chain_stage_update_preserves_other_stages():
    analysis = SupplyChainAnalysis(
        stages=[
            SupplyChainStage(
                stage_name="S0",
                suppliers=[SupplyChainMappedSupplier(name="X", role="r", sanctions_status="clear")],
                status="ok",
                note="",
            ),
            SupplyChainStage(
                stage_name="S1",
                suppliers=[],
                status="missing",
                note="old",
            ),
        ],
    )
    risk = [
        SupplierRiskResult(supplier_name="Y", status="clear", match=None, fuzzy_score=None, notes=None),
    ]
    out = apply_supply_chain_stage_update(
        analysis,
        1,
        [("Y", "role", None)],
        risk,
    )
    assert len(out.stages) == 2
    assert out.stages[0].stage_name == "S0"
    assert out.stages[1].status == "ok"
    assert out.stages[1].suppliers[0].name == "Y"


def test_refine_supply_chain_runs_screening_then_gemini_refactor():
    stages = [
        SupplyChainStage(
            stage_name="Assembly",
            suppliers=[SupplyChainMappedSupplier(name="Old", role="mfg", sanctions_status="clear")],
            status="ok",
            note="",
        ),
    ]
    body = SupplyChainStageUpdateRequest(
        product_description="Widget",
        stages=stages,
        stage_index=0,
        suppliers=[SupplyChainSupplierDraft(name="NewCo", role="packaging")],
        supplier_risk=[],
    )

    async def fake_screening(sups):
        return [
            SupplierRiskResult(
                supplier_name=sup.name,
                status="clear",
                match=None,
                fuzzy_score=None,
                notes=None,
            )
            for sup in sups
        ]

    refactored = SupplyChainAnalysis(
        stages=[
            SupplyChainStage(
                stage_name="Assembly",
                suppliers=[
                    SupplyChainMappedSupplier(name="NewCo", role="packaging", sanctions_status="clear"),
                ],
                status="ok",
                note="",
            ),
        ],
    )

    async def _run():
        with patch("app.services.supply_chain_refine.run_supplier_screening", side_effect=fake_screening):
            with patch(
                "app.services.supply_chain_refine.refactor_supply_chain_sync",
                return_value=refactored,
            ) as mock_refactor:
                out = await refine_supply_chain_after_stage_edit(body)
                assert out.stages[0].stage_name == "Assembly"
                assert out.stages[0].suppliers[0].name == "NewCo"
                assert mock_refactor.call_count == 1

    asyncio.run(_run())


def test_build_unified_report_includes_supply_chain_field():
    from app.schemas.report import ReportRequest
    from app.services.orchestrator import build_unified_report

    mock_reg = RegulatorySection(summary="s")

    async def fake_screening(sups):
        return [
            SupplierRiskResult(
                supplier_name=sup.name,
                status="clear",
                match=None,
                fuzzy_score=None,
                notes=None,
            )
            for sup in sups
        ]

    async def _run():
        with patch("app.services.orchestrator.run_supplier_screening", side_effect=fake_screening):
            with patch(
                "app.services.orchestrator.run_regulatory_rag",
                return_value=mock_reg,
            ):
                with patch(
                    "app.services.orchestrator.infer_supply_chain_sync",
                    return_value=_parsed_chain_fixture(),
                ):
                    return await build_unified_report(
                        ReportRequest(
                            product_description="Test product",
                            suppliers=[SupplierInput(name="A", role="makes parts")],
                        ),
                    )

    report = asyncio.run(_run())

    assert report.supply_chain is not None
    assert len(report.supply_chain.stages) == 1
    assert report.supply_chain.stages[0].stage_name == "Assembly"
    assert report.product_description == "Test product"
    assert len(report.supplier_risk) == 1
