"use client";

import type { SimulationResult } from "@/lib/simulation-types";
import { AiStreamPanel } from "../AiStreamPanel";
import { ComplianceList } from "../ComplianceList";

type BaselineRow = { name: string };

type Props = {
  baselineSuppliers: BaselineRow[];
  addBaselineRow: () => void;
  updateBaselineRow: (index: number, patch: Partial<BaselineRow>) => void;
  removeBaselineRow: (index: number) => void;
  event: string;
  setEvent: (v: string) => void;
  streaming: boolean;
  runWhatIf: () => void;
  narrative: string;
  result: SimulationResult | null;
  streamErr: string | null;
  parseErr: string | null;
};

export function WhatIfTab({
  baselineSuppliers,
  addBaselineRow,
  updateBaselineRow,
  removeBaselineRow,
  event,
  setEvent,
  streaming,
  runWhatIf,
  narrative,
  result,
  streamErr,
  parseErr,
}: Props) {
  const canRun = Boolean(event.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Baseline supply chain</h2>
        <p className="mt-1 text-xs text-zinc-500">Optional supplier names for context. You can run a scenario with none.</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase text-zinc-500">Suppliers</span>
          <button
            type="button"
            onClick={addBaselineRow}
            className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Add row
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {baselineSuppliers.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="min-w-[140px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Supplier name"
                value={row.name}
                onChange={(e) => updateBaselineRow(i, { name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeBaselineRow(i)}
                className="text-xs text-zinc-500 hover:text-rose-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-500">Scenario</h2>
        <textarea
          className="mb-3 min-h-[88px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm"
          placeholder='e.g. "60% tariff on China" or "Port strike in Los Angeles"'
          value={event}
          onChange={(e) => setEvent(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={streaming || !canRun}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-40"
            onClick={() => void runWhatIf()}
          >
            {streaming ? "Running simulation…" : "Run what-if"}
          </button>
        </div>
        {(streamErr || parseErr) && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {streamErr ?? parseErr}
            {parseErr && (
              <span className="mt-1 block text-xs">
                Tip: ensure the backend has GOOGLE_API_KEY set and the model returns a valid JSON block after{" "}
                <code className="rounded bg-rose-100 px-0.5">{"<<<SIM_JSON>>>"}</code>.
              </span>
            )}
          </p>
        )}
      </div>
      <AiStreamPanel narrative={narrative} isStreaming={streaming} />
      {result && result.complianceBlockers.length > 0 && (
        <ComplianceList items={result.complianceBlockers} title="Compliance blockers" />
      )}
    </div>
  );
}
