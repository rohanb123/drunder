import { baseUrl } from "./api";
import type { ProfileContext, SimulationResult, SupplierAfterSnapshot, SupplierSnapshot } from "./simulation-types";

function parseRisk(v: unknown): "high" | "medium" | "low" | null {
  return v === "high" || v === "medium" || v === "low" ? v : null;
}

function parseSupplierBefore(o: Record<string, unknown>): SupplierSnapshot | null {
  const risk = parseRisk(o.risk);
  if (!risk) return null;
  const spend = Number(o.spendSharePercent);
  if (!Number.isFinite(spend)) return null;
  return {
    name: String(o.name ?? ""),
    country: String(o.country ?? "").toUpperCase(),
    risk,
    spendSharePercent: spend,
  };
}

function parseSupplierAfter(o: Record<string, unknown>): SupplierAfterSnapshot | null {
  const base = parseSupplierBefore(o);
  if (!base) return null;
  const delta = Number(o.deltaSpendSharePercent);
  if (!Number.isFinite(delta)) return null;
  return { ...base, deltaSpendSharePercent: delta };
}

function parsePivot(o: Record<string, unknown>) {
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
}

export function parseSimulationJson(text: string): SimulationResult | null {
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
    let before: SupplierSnapshot[] = [];
    let after: SupplierAfterSnapshot[] = [];
    if (comp && typeof comp === "object") {
      if (Array.isArray(comp.before)) {
        before = (comp.before as unknown[])
          .map((x) => parseSupplierBefore(x as Record<string, unknown>))
          .filter(Boolean) as SupplierSnapshot[];
      }
      if (Array.isArray(comp.after)) {
        after = (comp.after as unknown[])
          .map((x) => parseSupplierAfter(x as Record<string, unknown>))
          .filter(Boolean) as SupplierAfterSnapshot[];
      }
    }
    const pivotsRaw = Array.isArray(raw.suggestedPivots) ? raw.suggestedPivots : [];
    const suggestedPivots = (pivotsRaw as unknown[])
      .map((p) => parsePivot(p as Record<string, unknown>))
      .filter(Boolean) as SimulationResult["suggestedPivots"];
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
            .filter(Boolean) as SimulationResult["complianceBlockers"]
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

export function splitStreamBuffer(buffer: string): { narrative: string; jsonPart: string | null } {
  const idx = buffer.indexOf("<<<SIM_JSON>>>");
  if (idx === -1) return { narrative: buffer, jsonPart: null };
  return {
    narrative: buffer.slice(0, idx).trimEnd(),
    jsonPart: buffer.slice(idx + "<<<SIM_JSON>>>".length).trim(),
  };
}

export type StreamOutcome = {
  narrative: string;
  result: SimulationResult | null;
  parseError?: string;
  streamError?: string;
};

export async function streamSimulation(
  event: string,
  profile: ProfileContext,
  onBuffer: (buffer: string) => void,
): Promise<StreamOutcome> {
  const res = await fetch(`${baseUrl()}/sentinel/simulate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, profile }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string | string[] };
      const d = j.detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    onBuffer(buffer);
  }
  if (buffer.includes("[STREAM_ERROR]")) {
    const msg = buffer.split("[STREAM_ERROR]")[1]?.trim() ?? "Stream failed";
    return { narrative: splitStreamBuffer(buffer).narrative, result: null, streamError: msg };
  }
  const { narrative, jsonPart } = splitStreamBuffer(buffer);
  if (!jsonPart) {
    return { narrative, result: null, parseError: "Model did not return <<<SIM_JSON>>> payload" };
  }
  const parsed = parseSimulationJson(jsonPart);
  if (!parsed) return { narrative, result: null, parseError: "Invalid simulation JSON" };
  return { narrative, result: parsed };
}
