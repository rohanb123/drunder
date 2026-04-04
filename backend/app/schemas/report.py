from typing import Literal

from pydantic import BaseModel, Field


class SupplierInput(BaseModel):
    """One supplier row from the form or parsed CSV."""

    name: str = Field(..., description="Legal or trade name to screen")
    country_of_origin: str = Field(
        ...,
        description="ISO country name or code as provided (normalized in tariff service)",
    )


class ReportRequest(BaseModel):
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
    fuzzy_score: float | None = Field(None, description="rapidfuzz ratio when applicable")
    notes: str | None = None


class TariffExposureResult(BaseModel):
    supplier_name: str
    country_of_origin: str
    hts_chapter: str = Field(..., description="4-digit HTS chapter from classification")
    duty_rate_percent: float | None = Field(None, description="From Trade.gov Tariff Rates API")
    api_source: str = Field(default="trade.gov_tariff_rates", description="Provenance label")


class RegulatoryCitation(BaseModel):
    title: str
    source: str = Field(..., description="Agency: FDA | CPSC | FTC")
    document_id: str | None = None
    chunk_id: str | None = None


class RegulatorySection(BaseModel):
    summary: str
    applicable_regulations: list[str] = Field(default_factory=list)
    testing_requirements: list[str] = Field(default_factory=list)
    estimated_compliance_cost_usd: float | None = None
    penalty_exposure_note: str | None = None
    citations: list[RegulatoryCitation] = Field(default_factory=list)


class ReportResponse(BaseModel):
    product_description: str
    supplier_risk: list[SupplierRiskResult]
    tariff_exposure: list[TariffExposureResult]
    regulatory: RegulatorySection
