export type RiskTier = "high" | "medium" | "low";

export type SupplierSnapshot = {
  name: string;
  country: string;
  risk: RiskTier;
  spendSharePercent: number;
};

export type SupplierAfterSnapshot = SupplierSnapshot & {
  deltaSpendSharePercent: number;
};

export type PivotRoute = {
  title: string;
  rationale: string;
  horizon: "near" | "mid" | "long";
  fromCountry: string;
  toCountry: string;
};

export type SimulationResult = {
  summary: string;
  marginImpactPercent: number;
  marginImpactDirection: "up" | "down" | "neutral";
  complianceBlockers: { title: string; detail: string; severity: RiskTier }[];
  suggestedPivots: PivotRoute[];
  supplierComparison: {
    before: SupplierSnapshot[];
    after: SupplierAfterSnapshot[];
  };
  riskLevel: "critical" | "elevated" | "moderate" | "low";
  confidenceNote: string;
};

export type ProfileContext = {
  profileName: string;
  suppliers: { name: string; country: string }[];
  htsCodes: { code: string; description: string | null }[];
  categories: { name: string }[];
};

export type StackedScenario = {
  id: string;
  label: string;
  event: string;
  marginImpactPercent: number;
  riskLevel: SimulationResult["riskLevel"];
  color: string;
};
