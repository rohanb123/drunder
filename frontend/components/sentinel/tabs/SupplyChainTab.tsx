"use client";

import { postSupplyChainStageUpdate } from "@/lib/api";
import type { SupplierRiskResult, SupplyChainAnalysis, SupplyChainStage } from "@/lib/types";
import { Fragment, useEffect, useState } from "react";

const EMPTY_STAGES: SupplyChainStage[] = [];

type DraftRow = {
  name: string;
  role: string;
};

function stageStatusBadgeClass(status: SupplyChainStage["status"]): string {
  switch (status) {
    case "ok":
      return "bg-emerald-100 text-emerald-900 ring-emerald-600/20";
    case "broken":
      return "bg-red-100 text-red-900 ring-red-600/20";
    case "missing":
      return "bg-amber-100 text-amber-950 ring-amber-600/25";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-500/20";
  }
}

function chainSanctionsPillClass(s: SupplyChainStage["suppliers"][0]["sanctions_status"]): string {
  switch (s) {
    case "flagged":
      return "bg-red-100 text-red-800";
    case "review":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-emerald-100 text-emerald-900";
  }
}

function nodeRingClass(status: SupplyChainStage["status"], selected: boolean): string {
  let base = "";
  switch (status) {
    case "ok":
      base = "border-emerald-200 bg-white ring-emerald-500/50";
      break;
    case "broken":
      base = "border-red-200 bg-red-50/40 ring-red-500/50";
      break;
    case "missing":
      base = "border-amber-200 bg-amber-50/40 ring-amber-500/40";
      break;
    default:
      base = "border-zinc-200 bg-white ring-zinc-300";
  }
  return `${base} ring-2 ${selected ? "ring-violet-600 ring-offset-2 ring-offset-white" : ""}`;
}

function connectorClass(left: SupplyChainStage["status"], right: SupplyChainStage["status"]): string {
  const bad = left === "broken" || right === "broken";
  const gap = left === "missing" || right === "missing";
  if (bad) return "bg-gradient-to-r from-red-300 via-red-200 to-red-300";
  if (gap) return "bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200";
  return "bg-gradient-to-r from-emerald-300 via-violet-200 to-emerald-300";
}

type StageStats = {
  total: number;
  ok: number;
  broken: number;
  missing: number;
  integrityPct: number;
  issueCount: number;
};

function computeStageStats(stages: SupplyChainStage[]): StageStats {
  const total = stages.length;
  if (!total) {
    return { total: 0, ok: 0, broken: 0, missing: 0, integrityPct: 0, issueCount: 0 };
  }
  let ok = 0;
  let broken = 0;
  let missing = 0;
  for (const st of stages) {
    if (st.status === "ok") ok += 1;
    else if (st.status === "broken") broken += 1;
    else missing += 1;
  }
  const issueCount = broken + missing;
  const integrityPct = Math.round((ok / total) * 100);
  return { total, ok, broken, missing, integrityPct, issueCount };
}

function ChainIntegrityStrip({ stats }: { stats: StageStats }) {
  return (
    <div className="flex flex-col gap-2 border-b border-zinc-200 pb-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-zinc-600">Integrity</span>
        <span className="text-xl font-bold tabular-nums text-violet-700">{stats.integrityPct}</span>
        <span className="text-sm font-semibold text-violet-600">%</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 ring-1 ring-inset ring-zinc-200/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 transition-[width] duration-500 ease-out"
            style={{ width: `${stats.integrityPct}%` }}
            role="progressbar"
            aria-valuenow={stats.integrityPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Chain integrity percentage"
          />
        </div>
      </div>
      <p className="shrink-0 text-[11px] text-zinc-500 sm:text-xs">
        <span className="tabular-nums text-zinc-700">{stats.total}</span> stages ·{" "}
        <span className="text-emerald-800">{stats.ok} ok</span> ·{" "}
        <span className="text-red-800">{stats.broken} broken</span> ·{" "}
        <span className="text-amber-900">{stats.missing} missing</span>
      </p>
      {stats.issueCount > 0 ? (
        <p className="text-[11px] text-zinc-600 sm:max-w-[200px] sm:text-right sm:text-xs">
          <span className="font-medium text-zinc-800">{stats.issueCount}</span> need attention — select a stage on the timeline.
        </p>
      ) : (
        <p className="text-[11px] text-emerald-800 sm:text-xs">All stages clear.</p>
      )}
    </div>
  );
}

function ContinuousTimeline({
  stages,
  selectedIndex,
  onSelect,
}: {
  stages: SupplyChainStage[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-900">Flow timeline</h3>
      <p className="mt-0.5 text-xs text-zinc-500">
        Left to right: upstream → downstream. Connectors reflect health between stages.{" "}
        <span className="font-medium text-zinc-700">Select a stage</span> to read the full note and suppliers.
      </p>

      <div className="mt-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300">
        <div
          className="relative min-w-[min(100%,720px)] bg-zinc-50/90 px-2 py-8 sm:min-w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 23px, rgb(228 228 231 / 0.6) 23px, rgb(228 228 231 / 0.6) 24px)",
          }}
        >
          <div className="flex min-w-max items-center sm:min-w-0" role="tablist" aria-label="Supply chain stages">
            {stages.map((st, i) => (
              <Fragment key={`${st.stage_name}-${i}`}>
                {i > 0 ? (
                  <div
                    className={`mx-1 h-1.5 w-8 shrink-0 rounded-full sm:mx-0 sm:flex-1 sm:min-w-[1.5rem] ${connectorClass(stages[i - 1].status, st.status)}`}
                    aria-hidden
                  />
                ) : null}
                <div className="flex w-[132px] shrink-0 flex-col items-center sm:w-auto sm:min-w-[100px] sm:flex-1 sm:max-w-[180px]">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedIndex === i}
                    aria-controls="supply-chain-stage-panel"
                    id={`supply-chain-stage-${i}`}
                    onClick={() => onSelect(i)}
                    className={`relative z-10 w-full rounded-xl border-2 px-2 py-3 text-center shadow-sm transition hover:border-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${nodeRingClass(st.status, selectedIndex === i)}`}
                  >
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-800">
                      {i + 1}
                    </span>
                    <p className="mt-2 line-clamp-3 text-[11px] font-semibold leading-tight text-zinc-900 sm:text-xs">
                      {st.stage_name}
                    </p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${stageStatusBadgeClass(st.status)}`}
                    >
                      {st.status}
                    </span>
                    <p className="mt-1.5 text-[10px] tabular-nums text-zinc-500">
                      {st.suppliers.length} supplier{st.suppliers.length === 1 ? "" : "s"}
                    </p>
                  </button>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function stageSuppliersSignature(stage: SupplyChainStage | undefined): string {
  if (!stage) return "";
  return stage.suppliers.map((s) => `${s.name}\0${s.role}\0${s.sanctions_status}`).join("|");
}

function SelectedStagePanel({
  stage,
  index,
  onTakeAction,
}: {
  stage: SupplyChainStage;
  index: number;
  onTakeAction?: (supplier: string, note: string) => void;
}) {
  return (
    <div
      id="supply-chain-stage-panel"
      role="tabpanel"
      aria-labelledby={`supply-chain-stage-${index}`}
      className={`mt-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 shadow-sm ring-1 ring-zinc-100 border-l-4 sm:p-5 ${
        stage.status === "ok"
          ? "border-l-emerald-500"
          : stage.status === "broken"
            ? "border-l-red-500"
            : "border-l-amber-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-violet-700 shadow ring-1 ring-violet-200">
            {index + 1}
          </span>
          <h4 className="text-base font-semibold text-zinc-900">{stage.stage_name}</h4>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${stageStatusBadgeClass(stage.status)}`}
        >
          {stage.status}
        </span>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        <span className="font-medium text-zinc-800">Broken</span> = a mapped supplier is in review or flagged on
        sanctions. <span className="font-medium text-zinc-800">Missing</span> = no supplier assigned to this stage (gap
        only—no vendor suggestions).
      </p>

      {stage.note ? <p className="mt-3 text-sm text-zinc-700">{stage.note}</p> : null}

      {stage.suppliers.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-zinc-200/80 pt-4">
          {stage.suppliers.map((sup) => (
            <li
              key={`${stage.stage_name}-${sup.name}-${sup.role}`}
              className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium text-zinc-900">{sup.name}</span>
                {sup.role ? <span className="mt-0.5 block text-xs text-zinc-500">{sup.role}</span> : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${chainSanctionsPillClass(sup.sanctions_status)}`}
              >
                {sup.sanctions_status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm italic text-zinc-500">No suppliers mapped to this stage.</p>
      )}

      {/* Take action CTA — only for broken stages with a flagged/review supplier */}
      {stage.status === "broken" && onTakeAction && (() => {
        const problematic = stage.suppliers.find(
          (s) => s.sanctions_status === "flagged" || s.sanctions_status === "review",
        );
        if (!problematic) return null;
        const noteText = `Stage "${stage.stage_name}" has a sanctions concern. Supplier ${problematic.name} is ${problematic.sanctions_status}. ${stage.note ?? ""}`.trim();
        return (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-900">Sanctions concern detected</p>
              <p className="mt-0.5 text-xs text-red-700">
                {problematic.name} is <span className="font-medium capitalize">{problematic.sanctions_status}</span> — automated action recommended
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTakeAction(problematic.name, noteText)}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 transition"
            >
              Take action
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function RefineStageSuppliersPanel({
  productDescription,
  stages,
  selectedIndex,
  supplierRisk,
  onUpdated,
}: {
  productDescription: string;
  stages: SupplyChainStage[];
  selectedIndex: number;
  supplierRisk: SupplierRiskResult[];
  onUpdated: (next: SupplyChainAnalysis) => void;
}) {
  const selectedStage = stages[selectedIndex];
  const supplierSig = stageSuppliersSignature(selectedStage);

  const [draftRows, setDraftRows] = useState<DraftRow[]>([{ name: "", role: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStage) return;
    setErr(null);
    if (selectedStage.suppliers.length === 0) {
      setDraftRows([{ name: "", role: "" }]);
      return;
    }
    setDraftRows(
      selectedStage.suppliers.map((s) => ({
        name: s.name,
        role: s.role,
      })),
    );
  }, [selectedIndex, supplierSig]);

  const addRow = () => {
    setDraftRows((rows) => [...rows, { name: "", role: "" }]);
  };

  const removeRow = (i: number) => {
    setDraftRows((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== i)));
  };

  const patchRow = (i: number, patch: Partial<DraftRow>) => {
    setDraftRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const apply = async () => {
    setErr(null);
    const suppliers = draftRows
      .map((r) => ({
        name: r.name.trim(),
        role: r.role.trim(),
      }))
      .filter((r) => r.name.length > 0);

    setBusy(true);
    try {
      const next = await postSupplyChainStageUpdate({
        product_description: productDescription.trim() || "Product",
        stages,
        stage_index: selectedIndex,
        suppliers,
        supplier_risk: supplierRisk,
      });
      onUpdated(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (!selectedStage) return null;

  return (
    <div className="mt-6 border-t border-zinc-200 pt-5">
      <h3 className="text-sm font-semibold text-zinc-900">Refine mapped suppliers</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Adjust who sits in <span className="font-medium text-zinc-800">{selectedStage.stage_name}</span>. Apply runs a
        live sanctions check on these suppliers (Trade.gov list path), then Gemini (when configured) may **reassign**
        suppliers across the **existing** timeline stages only — stage names and count stay fixed. You cannot set
        sanctions manually.
      </p>

      <div className="mt-4 space-y-3">
        {draftRows.map((row, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <label className="min-w-0 flex-1 sm:min-w-[140px]">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Name</span>
              <input
                type="text"
                value={row.name}
                onChange={(e) => patchRow(i, { name: e.target.value })}
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                placeholder="Supplier name"
                autoComplete="off"
              />
            </label>
            <label className="min-w-0 flex-1 sm:min-w-[140px]">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Role</span>
              <input
                type="text"
                value={row.role}
                onChange={(e) => patchRow(i, { role: e.target.value })}
                className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                placeholder="What they do at this stage"
                autoComplete="off"
              />
            </label>
            <div className="flex gap-2 sm:ml-auto sm:pt-5">
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={draftRows.length <= 1}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Add supplier row
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={busy}
          className="rounded-md bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Screening & updating…" : "Apply to timeline"}
        </button>
      </div>
      {err ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function SupplyChainMappingBody({
  productDescription,
  analysis,
  supplierRisk,
  onSupplyChainUpdated,
  onTakeAction,
}: {
  productDescription: string;
  analysis: SupplyChainAnalysis;
  supplierRisk: SupplierRiskResult[];
  onSupplyChainUpdated: (next: SupplyChainAnalysis) => void;
  onTakeAction?: (supplier: string, note: string) => void;
}) {
  const stages = analysis.stages?.length ? analysis.stages : EMPTY_STAGES;
  const total = stages.length;
  const stats = computeStageStats(stages);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const stageLayoutKey = stages.map((s) => s.stage_name).join("\0");

  useEffect(() => {
    const idx = stages.findIndex((x) => x.status !== "ok");
    setSelectedIndex(idx >= 0 ? idx : 0);
    // Only reset when the stage *layout* (names/order/count) changes, not when suppliers/status are edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stages is intentionally omitted
  }, [stageLayoutKey]);

  const safeIndex = total > 0 ? Math.min(Math.max(0, selectedIndex), total - 1) : 0;
  const selectedStage = stages[safeIndex];

  const brokenStages = stages.filter((s) => s.status === "broken");

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">No supply chain stages in this report.</p>
          <p className="mt-1 text-xs text-amber-900/90">
            The API needs <code className="rounded bg-amber-100/80 px-1">GOOGLE_API_KEY</code> set for Gemini. If the
            key is set, the model may have returned output we could not parse—check server logs and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Issues requiring action */}
      {brokenStages.length > 0 && onTakeAction && (
        <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-red-900">
                {brokenStages.length} stage{brokenStages.length !== 1 ? "s" : ""} need attention
              </p>
              <p className="text-xs text-red-700">Sanctions concerns detected — take action to resolve</p>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100">
            {brokenStages.map((stage, i) => {
              const flaggedSuppliers = stage.suppliers.filter(
                (s) => s.sanctions_status === "flagged" || s.sanctions_status === "review",
              );
              const primarySupplier = flaggedSuppliers[0];
              return (
                <li key={`${stage.stage_name}-${i}`} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">{stage.stage_name}</p>
                      {primarySupplier && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          <span
                            className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                              primarySupplier.sanctions_status === "flagged"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {primarySupplier.sanctions_status}
                          </span>
                          {primarySupplier.name}
                          {flaggedSuppliers.length > 1 && (
                            <span className="ml-1 text-zinc-400">+{flaggedSuppliers.length - 1} more</span>
                          )}
                        </p>
                      )}
                      {stage.note && (
                        <p className="mt-1 text-xs text-zinc-400 line-clamp-1">{stage.note}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const sup = primarySupplier ?? stage.suppliers[0];
                      if (!sup) return;
                      const note = `Stage "${stage.stage_name}" has a sanctions concern. Supplier ${sup.name} is ${sup.sanctions_status}. ${stage.note ?? ""}`.trim();
                      onTakeAction(sup.name, note);
                    }}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
                  >
                    Take action
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm ring-1 ring-zinc-100 sm:p-6">
        <ChainIntegrityStrip stats={stats} />
        <ContinuousTimeline stages={stages} selectedIndex={safeIndex} onSelect={setSelectedIndex} />
        {selectedStage ? <SelectedStagePanel stage={selectedStage} index={safeIndex} onTakeAction={onTakeAction} /> : null}
        <RefineStageSuppliersPanel
          productDescription={productDescription}
          stages={stages}
          selectedIndex={safeIndex}
          supplierRisk={supplierRisk}
          onUpdated={onSupplyChainUpdated}
        />
      </div>
    </div>
  );
}

type Props = {
  productDescription: string;
  analysis: SupplyChainAnalysis;
  supplierRisk: SupplierRiskResult[];
  onSupplyChainUpdated: (next: SupplyChainAnalysis) => void;
  onTakeAction?: (supplier: string, note: string) => void;
};

export function SupplyChainTab({ productDescription, analysis, supplierRisk, onSupplyChainUpdated, onTakeAction }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-0 sm:px-1">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ring-1 ring-zinc-100">
        <h2 className="text-lg font-semibold text-zinc-900">Supply chain mapping</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Inferred stages (Gemini) from your product description and supplier roles in the compliance report. Each stage
          is <span className="font-medium text-zinc-700">ok</span>,{" "}
          <span className="font-medium text-zinc-700">broken</span> (sanctions concern), or{" "}
          <span className="font-medium text-zinc-700">missing</span> (no supplier mapped).
        </p>
        {productDescription.trim() ? (
          <p className="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-sm text-zinc-700">
            <span className="font-medium text-violet-900">Product: </span>
            {productDescription.trim()}
          </p>
        ) : null}
      </div>
      <SupplyChainMappingBody
        productDescription={productDescription}
        analysis={analysis}
        supplierRisk={supplierRisk}
        onSupplyChainUpdated={onSupplyChainUpdated}
        onTakeAction={onTakeAction}
      />
    </div>
  );
}
