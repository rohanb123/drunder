/** Mirrors backend `app/schemas/report.py` for typed fetch responses. */

export type SupplierInput = {
  name: string;
  country_of_origin: string;
};

export type ReportRequest = {
  product_description: string;
  suppliers: SupplierInput[];
};

export type MatchedListEntry = {
  source_list: string;
  entity_type: string | null;
  matched_name: string;
  aliases: string[];
  country: string | null;
};

export type SupplierRiskResult = {
  supplier_name: string;
  status: "clear" | "review" | "flagged";
  match: MatchedListEntry | null;
  fuzzy_score: number | null;
  notes: string | null;
};

export type TariffExposureResult = {
  supplier_name: string;
  country_of_origin: string;
  hts_chapter: string;
  duty_rate_percent: number | null;
  api_source: string;
};

export type RegulatoryCitation = {
  title: string;
  source: string;
  document_id: string | null;
  chunk_id: string | null;
};

export type RegulatorySection = {
  summary: string;
  applicable_regulations: string[];
  testing_requirements: string[];
  estimated_compliance_cost_usd: number | null;
  penalty_exposure_note: string | null;
  citations: RegulatoryCitation[];
};

export type ReportResponse = {
  product_description: string;
  supplier_risk: SupplierRiskResult[];
  tariff_exposure: TariffExposureResult[];
  regulatory: RegulatorySection;
};
