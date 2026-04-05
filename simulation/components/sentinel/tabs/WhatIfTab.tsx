"use client";

import type { ProfileContext, SimulationResult, StackedScenario } from "@/lib/simulation-types";
import { AiStreamPanel } from "../AiStreamPanel";
import { BeforeAfterSuppliers } from "../BeforeAfterSuppliers";
import { ComplianceList } from "../ComplianceList";
import { ImpactGauge } from "../ImpactGauge";
import { ScenarioComparisonChart } from "../ScenarioComparisonChart";

type Props = {
  profilesLength: number;
  selectedId: string | null;
  ctx: ProfileContext | null;
  event: string;
  setEvent: (v: string) => void;
  useStream: boolean;
  setUseStream: (v: boolean) => void;
  streaming: boolean;
  runWhatIf: () => void;
  narrative: string;
  result: SimulationResult | null;
  streamErr: string | null;
  parseErr: string | null;
  scenarioLabel: string;
  setScenarioLabel: (v: string) => void;
  stacked: StackedScenario[];
  pinScenario: () => void;
  clearStack: () => void;
};

export function WhatIfTab({
  profilesLength,
  selectedId,
  ctx,
  event,
  setEvent,
  useStream,
  setUseStream,
  streaming,
  runWhatIf,
  narrative,
  result,
  streamErr,
  parseErr,
  scenarioLabel,
  setScenarioLabel,
  stacked,
  pinScenario,
  clearStack,
}: Props) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Scenario</h2>
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} />
              Stream live (needs GEMINI_API_KEY in .env.local)
            </label>
          </div>
          {!selectedId && profilesLength > 0 && (
            <p className="mb-2 text-xs text-amber-600">Select a profile in the Profile tab first.</p>
          )}
          <textarea
            className="mb-3 min-h-[88px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm"
            placeholder='e.g. "60% tariff on China" or "Port strike in Los Angeles"'
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={streaming || !ctx || !event.trim()}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-40"
              onClick={() => void runWhatIf()}
            >
              {streaming ? "Running simulation…" : "Run what-if"}
            </button>
            {result && (
              <>
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="Label for comparison chart"
                  value={scenarioLabel}
                  onChange={(e) => setScenarioLabel(e.target.value)}
                />
                <button
                  type="button"
                  disabled={stacked.length >= 3}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-800 disabled:opacity-40"
                  onClick={pinScenario}
                >
                  Pin to compare ({stacked.length}/3)
                </button>
                <button type="button" className="text-sm text-zinc-500 underline" onClick={clearStack}>
                  Clear pins
                </button>
              </>
            )}
          </div>
          {(streamErr || parseErr) && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {streamErr ?? parseErr}
              {parseErr && useStream && (
                <span className="mt-1 block text-xs">
                  Tip: confirm .env.local has GEMINI_API_KEY for streaming, or turn off streaming to use Convex
                  only.
                </span>
              )}
            </p>
          )}
        </div>
        <AiStreamPanel narrative={narrative} isStreaming={streaming} />
        {result && (
          <>
            <BeforeAfterSuppliers comparison={result.supplierComparison} />
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-zinc-800">Executive summary</h3>
              <p className="text-sm text-zinc-600">{result.summary}</p>
              <p className="mt-2 text-xs text-zinc-400">{result.confidenceNote}</p>
            </div>
          </>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-zinc-500">Impact meter</h3>
          <ImpactGauge value={result?.marginImpactPercent ?? 0} isRunning={streaming} />
          {result && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              Risk band: <span className="font-semibold text-zinc-800">{result.riskLevel}</span>
            </p>
          )}
        </div>
        <ScenarioComparisonChart scenarios={stacked} />
        {result && result.complianceBlockers.length > 0 && (
          <ComplianceList items={result.complianceBlockers} title="Compliance blockers" />
        )}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs text-emerald-800">
          Database synced · Convex live
        </div>
      </div>
    </div>
  );
}
