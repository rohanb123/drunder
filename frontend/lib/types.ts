/** Shapes returned by the report service (aligned with server models). */

export type SupplierInput = {
  name: string;
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

/** Full report: supplier screening + regulatory section. */
export type ReportResponse = {
  product_description: string;
  supplier_risk: SupplierRiskResult[];
  regulatory: RegulatorySection;
};
