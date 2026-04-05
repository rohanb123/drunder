from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SupplierInput(BaseModel):
    """One supplier row from the form or parsed CSV."""

    name: str = Field(..., min_length=1, description="Legal or trade name to screen")
    role: str = Field(
        ...,
        min_length=1,
        description="Required: short description of what the company does / its role (e.g. raw material supplier, co-packer)",
    )

    @field_validator("name", "role", mode="before")
    @classmethod
    def strip_whitespace(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class ReportRequest(BaseModel):
    """Inbound payload: product context plus suppliers to screen."""

    product_description: str = Field(..., min_length=1, description="What you sell")
    suppliers: list[SupplierInput] = Field(..., min_length=1)


class WhatIfComplianceBlockerPdf(BaseModel):
    title: str = ""
    detail: str = ""
    severity: Literal["high", "medium", "low"] = "medium"


class WhatIfPdfSection(BaseModel):
    """Optional appendix for unified PDF: scenario + model output from the Sentinel what-if flow."""

    scenario_prompt: str = ""
    narrative: str = ""
    compliance_blockers: list[WhatIfComplianceBlockerPdf] = Field(default_factory=list)


class ReportPdfRequest(BaseModel):
    """POST /report/pdf body: same as ReportRequest plus optional what-if appendix."""

    product_description: str = Field(..., min_length=1, description="What you sell")
    suppliers: list[SupplierInput] = Field(..., min_length=1)
    what_if: WhatIfPdfSection | None = None


class MatchedListEntry(BaseModel):
    source_list: str
    entity_type: str | None = None
    matched_name: str
    aliases: list[str] = Field(default_factory=list)
    country: str | None = None


class SupplierRiskResult(BaseModel):
    supplier_name: str
    status: Literal["clear", "review", "flagged"]
    match: MatchedListEntry | None = None
    fuzzy_score: float | None = Field(None, description="Similarity score when fuzzy matching is used")
    notes: str | None = None
    role: str = Field(
        default="",
        description="Echo of client-supplied description/role (what the supplier does); not used for screening logic",
    )


class RegulatoryCitation(BaseModel):
    title: str
    source: str = Field(..., description="Agency: FDA | CPSC | FTC")
    cfr_citation: str | None = Field(None, description="CFR reference from chunk metadata when available")
    document_id: str | None = None
    chunk_id: str | None = None
    # Relative path under regulatory_pdfs (e.g. fda/guide.pdf); used with GET /regulatory/pdfs?path=…
    source_file: str | None = Field(None, description="Path relative to regulatory PDF root for opening the source PDF")
    # 1-based page from ingest (chunk start page); clients may append #page=N to the PDF URL
    source_page: int | None = Field(None, description="1-based starting PDF page for this chunk")


class RegulatoryBullet(BaseModel):
    """One regulatory bullet with optional links to citation chunk_ids."""

    text: str
    citation_chunk_ids: list[str] = Field(default_factory=list)


class RegulatorySection(BaseModel):
    summary: str
    applicable_regulations: list[RegulatoryBullet] = Field(default_factory=list)
    testing_requirements: list[RegulatoryBullet] = Field(default_factory=list)
    estimated_compliance_cost_usd: float | None = None
    penalty_exposure_note: str | None = None
    citations: list[RegulatoryCitation] = Field(default_factory=list)


SupplyChainStageStatus = Literal["ok", "broken", "missing"]
SanctionsStatusForChain = Literal["clear", "review", "flagged"]


class SupplyChainMappedSupplier(BaseModel):
    """One supplier placed on a supply-chain stage (from model output)."""

    name: str
    role: str = ""
    sanctions_status: SanctionsStatusForChain


class SupplyChainStage(BaseModel):
    """One ordered stage in the inferred supply chain."""

    stage_name: str
    suppliers: list[SupplyChainMappedSupplier] = Field(default_factory=list)
    status: SupplyChainStageStatus
    note: str = Field(
        default="",
        description="Non-empty when status is broken or missing: short explanation only",
    )


class SupplyChainAnalysis(BaseModel):
    """Gemini inference: stages, mappings, and coverage/sanctions gaps (additive to /report)."""

    stages: list[SupplyChainStage] = Field(default_factory=list)


class SupplyChainSupplierDraft(BaseModel):
    """User-edited supplier row (name + role only). Sanctions come from live screening + refactor."""

    name: str = ""
    role: str = ""

    @field_validator("name", "role", mode="before")
    @classmethod
    def strip_whitespace(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()


class SupplyChainStageUpdateRequest(BaseModel):
    """Edits for one stage: live sanctions screening on those rows, then optional single-Gemini full refactor."""

    product_description: str = Field(..., min_length=1, description="Same product context as the compliance report")
    stages: list[SupplyChainStage] = Field(..., min_length=1)
    stage_index: int = Field(..., ge=0)
    suppliers: list[SupplyChainSupplierDraft] = Field(
        default_factory=list,
        description="Suppliers assigned to this stage after edit (empty = missing stage)",
    )
    supplier_risk: list[SupplierRiskResult] = Field(
        default_factory=list,
        description="Legacy echo from the report; not used for edited rows (those are re-screened)",
    )


class ReportResponse(BaseModel):
    """Unified compliance report: sanctions screening + regulatory synthesis."""

    product_description: str
    supplier_risk: list[SupplierRiskResult]
    regulatory: RegulatorySection
    supply_chain: SupplyChainAnalysis = Field(
        default_factory=SupplyChainAnalysis,
        description="Inferred chain stages, supplier mapping, and ok/broken/missing status",
    )
