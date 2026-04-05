from typing import Literal

from pydantic import BaseModel, Field


class SupplierInput(BaseModel):
    """One supplier row from the form or parsed CSV."""

    name: str = Field(..., description="Legal or trade name to screen")


class ReportRequest(BaseModel):
    """Inbound payload: product context plus suppliers to screen."""

    product_description: str = Field(..., min_length=1, description="What you sell")
    suppliers: list[SupplierInput] = Field(..., min_length=1)


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


class RegulatoryCitation(BaseModel):
    title: str
    source: str = Field(..., description="Agency: FDA | CPSC | FTC")
    cfr_citation: str | None = Field(None, description="CFR reference from chunk metadata when available")
    document_id: str | None = None
    chunk_id: str | None = None


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


class ReportResponse(BaseModel):
    """Unified compliance report: sanctions screening + regulatory synthesis."""

    product_description: str
    supplier_risk: list[SupplierRiskResult]
    regulatory: RegulatorySection
