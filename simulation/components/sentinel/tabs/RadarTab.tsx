"use client";

import type { SimulationResult, StackedScenario } from "@/lib/simulation-types";
import dynamic from "next/dynamic";
import { ComplianceList } from "../ComplianceList";
import { ScenarioComparisonChart } from "../ScenarioComparisonChart";

const PivotMap = dynamic(() => import("../PivotMap").then((m) => ({ default: m.PivotMap })), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl bg-slate-900 text-slate-500">Loading map…</div>
  ),
});

type Props = {
  stacked: StackedScenario[];
  result: SimulationResult | null;
};

export function RadarTab({ stacked, result }: Props) {
  return (
    <div className="space-y-6">
      <ScenarioComparisonChart scenarios={stacked} />
      {result ? (
        <PivotMap pivots={result.suggestedPivots} />
      ) : (
        <p className="text-sm text-zinc-500">Run a what-if to render pivot routes on the map.</p>
      )}
      {result && result.complianceBlockers.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold">Regulatory radar</h3>
          <ComplianceList items={result.complianceBlockers} variant="inline" />
        </div>
      )}
    </div>
  );
}
