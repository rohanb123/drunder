/** Shapes returned by the report service (aligned with server models). */

export type SupplierInput = {
  name: string;
  /** Required: short description / role (what the supplier does); sent to /report for supply-chain mapping. */
  role: string;
};

export type ReportRequest = {
  product_description: string;
  suppliers: SupplierInput[];
};

/** Optional appendix for POST /report/pdf (Sentinel unified export). */
export type WhatIfComplianceBlockerPdf = {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

export type WhatIfPdfSection = {
  scenario_prompt: string;
  narrative: string;
  compliance_blockers: WhatIfComplianceBlockerPdf[];
};

export type ReportPdfRequest = ReportRequest & {
  what_if?: WhatIfPdfSection | null;
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
  /** Echoed from your request (what the supplier does). */
  role?: string;
};

export type RegulatoryCitation = {
  title: string;
  source: string;
  cfr_citation: string | null;
  document_id: string | null;
  chunk_id: string | null;
  /** Relative path under server regulatory_pdfs; open via /regulatory/pdfs?path= */
  source_file?: string | null;
  /** 1-based page in the source PDF (chunk start); use as URL fragment #page=N */
  source_page?: number | null;
};

export type RegulatoryBullet = {
  text: string;
  citation_chunk_ids: string[];
};

export type RegulatorySection = {
  summary: string;
  applicable_regulations: RegulatoryBullet[];
  testing_requirements: RegulatoryBullet[];
  estimated_compliance_cost_usd: number | null;
  penalty_exposure_note: string | null;
  citations: RegulatoryCitation[];
};

export type SupplyChainMappedSupplier = {
  name: string;
  role: string;
  sanctions_status: "clear" | "review" | "flagged";
};

export type SupplyChainStage = {
  stage_name: string;
  suppliers: SupplyChainMappedSupplier[];
  status: "ok" | "broken" | "missing";
  note: string;
};

export type SupplyChainAnalysis = {
  stages: SupplyChainStage[];
};

/** POST /report/supply-chain/update-stage */
export type SupplyChainSupplierDraft = {
  name: string;
  role: string;
};

export type SupplyChainStageUpdateRequest = {
  product_description: string;
  stages: SupplyChainStage[];
  stage_index: number;
  suppliers: SupplyChainSupplierDraft[];
  /** Echo from report; server re-screens edited rows via the gov list. */
  supplier_risk: SupplierRiskResult[];
};

/** Full report: supplier screening + regulatory section + supply-chain inference. */
export type ReportResponse = {
  product_description: string;
  supplier_risk: SupplierRiskResult[];
  regulatory: RegulatorySection;
  supply_chain: SupplyChainAnalysis;
};
