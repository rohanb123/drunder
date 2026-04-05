/** Convex-local copy of lib/simulation (JSON-only path + parse). */

type Ctx = {
  profileName: string;
  suppliers: { name: string; country: string }[];
  htsCodes: { code: string; description: string | null }[];
  categories: { name: string }[];
};

const JSON_SCHEMA = `{
  "summary": string,
  "marginImpactPercent": number,
  "marginImpactDirection": "up" | "down" | "neutral",
  "complianceBlockers": { "title": string, "detail": string, "severity": "high"|"medium"|"low" }[],
  "suggestedPivots": {
    "title": string,
    "rationale": string,
    "horizon": "near"|"mid"|"long",
    "fromCountry": string,
    "toCountry": string
  }[],
  "supplierComparison": {
    "before": { "name": string, "country": string, "risk": "high"|"medium"|"low", "spendSharePercent": number }[],
    "after": { "name": string, "country": string, "risk": "high"|"medium"|"low", "spendSharePercent": number, "deltaSpendSharePercent": number }[]
  },
  "riskLevel": "critical"|"elevated"|"moderate"|"low",
  "confidenceNote": string
}`;

const RULES = `Rules:
- supplierComparison.before must list the same suppliers as the profile (same names; keep country codes as ISO 3166-1 alpha-2 uppercase where possible). Assign plausible baseline spendSharePercent summing to ~100.
- supplierComparison.after: same suppliers, post-shock risk and spend shares; deltaSpendSharePercent is change in share (negative means share dropped).
- suggestedPivots: include fromCountry and toCountry as ISO 3166-1 alpha-2 (e.g. CN, VN, MX). Each pivot is a plausible reroute.
- summary in JSON: 2–4 sentences distilled from your analysis.`;

export function buildJsonOnlySimulationPrompt(event: string, ctx: Ctx): string {
  const suppliers = ctx.suppliers.map((s) => `- ${s.name} (${s.country})`).join("\n");
  const hts = ctx.htsCodes.map((h) => `- ${h.code}${h.description ? `: ${h.description}` : ""}`).join("\n");
  const cats = ctx.categories.map((c) => `- ${c.name}`).join("\n");
  return `You are a supply chain and trade compliance analyst. The user describes a hypothetical macro or policy event. Use ONLY the profile below as the company's baseline.

Supply chain profile: "${ctx.profileName}"

Suppliers:
${suppliers || "(none)"}

HTS codes in scope:
${hts || "(none)"}

Product categories:
${cats || "(none)"}

Hypothetical event:
"${event}"

OUTPUT: Respond with ONLY a single JSON object (no markdown fences, no delimiter line, no prose before or after). Shape:

${JSON_SCHEMA}

${RULES}`;
}

export type ParsedSimulation = {
  summary: string;
  marginImpactPercent: number;
  marginImpactDirection: "up" | "down" | "neutral";
  complianceBlockers: { title: string; detail: string; severity: "high" | "medium" | "low" }[];
  suggestedPivots: {
    title: string;
    rationale: string;
    horizon: "near" | "mid" | "long";
    fromCountry: string;
    toCountry: string;
  }[];
  supplierComparison: {
    before: {
      name: string;
      country: string;
      risk: "high" | "medium" | "low";
      spendSharePercent: number;
    }[];
    after: {
      name: string;
      country: string;
      risk: "high" | "medium" | "low";
      spendSharePercent: number;
      deltaSpendSharePercent: number;
    }[];
  };
  riskLevel: "critical" | "elevated" | "moderate" | "low";
  confidenceNote: string;
};

function parseRisk(v: unknown): "high" | "medium" | "low" | null {
  return v === "high" || v === "medium" || v === "low" ? v : null;
}

export function parseSimulationJson(text: string): ParsedSimulation | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const marginImpactPercent = Number(raw.marginImpactPercent);
    const dir = raw.marginImpactDirection;
    if (!Number.isFinite(marginImpactPercent) || (dir !== "up" && dir !== "down" && dir !== "neutral")) {
      return null;
    }
    const risk = raw.riskLevel;
    if (risk !== "critical" && risk !== "elevated" && risk !== "moderate" && risk !== "low") {
      return null;
    }
    const comp = raw.supplierComparison as Record<string, unknown> | undefined;
    let before: ParsedSimulation["supplierComparison"]["before"] = [];
    let after: ParsedSimulation["supplierComparison"]["after"] = [];
    if (comp && typeof comp === "object") {
      if (Array.isArray(comp.before)) {
        before = (comp.before as unknown[])
          .map((x) => {
            const o = x as Record<string, unknown>;
            const r = parseRisk(o.risk);
            const spend = Number(o.spendSharePercent);
            if (!r || !Number.isFinite(spend)) return null;
            return {
              name: String(o.name ?? ""),
              country: String(o.country ?? "").toUpperCase(),
              risk: r,
              spendSharePercent: spend,
            };
          })
          .filter(Boolean) as ParsedSimulation["supplierComparison"]["before"];
      }
      if (Array.isArray(comp.after)) {
        after = (comp.after as unknown[])
          .map((x) => {
            const o = x as Record<string, unknown>;
            const r = parseRisk(o.risk);
            const spend = Number(o.spendSharePercent);
            const delta = Number(o.deltaSpendSharePercent);
            if (!r || !Number.isFinite(spend) || !Number.isFinite(delta)) return null;
            return {
              name: String(o.name ?? ""),
              country: String(o.country ?? "").toUpperCase(),
              risk: r,
              spendSharePercent: spend,
              deltaSpendSharePercent: delta,
            };
          })
          .filter(Boolean) as ParsedSimulation["supplierComparison"]["after"];
      }
    }
    const pivotsRaw = Array.isArray(raw.suggestedPivots) ? raw.suggestedPivots : [];
    const suggestedPivots = (pivotsRaw as unknown[])
      .map((p) => {
        const o = p as Record<string, unknown>;
        const h = o.horizon;
        if (h !== "near" && h !== "mid" && h !== "long") return null;
        const from = String(o.fromCountry ?? "").toUpperCase();
        const to = String(o.toCountry ?? "").toUpperCase();
        if (!from || !to) return null;
        return {
          title: String(o.title ?? ""),
          rationale: String(o.rationale ?? ""),
          horizon: h,
          fromCountry: from,
          toCountry: to,
        };
      })
      .filter(Boolean) as ParsedSimulation["suggestedPivots"];
    return {
      summary: String(raw.summary ?? ""),
      marginImpactPercent,
      marginImpactDirection: dir,
      complianceBlockers: Array.isArray(raw.complianceBlockers)
        ? (raw.complianceBlockers as unknown[])
            .map((b) => {
              const o = b as Record<string, unknown>;
              const sev = parseRisk(o.severity);
              if (!sev) return null;
              return { title: String(o.title ?? ""), detail: String(o.detail ?? ""), severity: sev };
            })
            .filter(Boolean) as ParsedSimulation["complianceBlockers"]
        : [],
      suggestedPivots,
      supplierComparison: { before, after },
      riskLevel: risk,
      confidenceNote: String(raw.confidenceNote ?? ""),
    };
  } catch {
    return null;
  }
}
