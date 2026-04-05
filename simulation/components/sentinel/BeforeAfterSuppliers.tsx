"use client";

import type { SimulationResult } from "@/lib/simulation-types";
import { motion } from "framer-motion";
import { RiskBadge } from "./RiskBadge";

type Props = {
  comparison: SimulationResult["supplierComparison"];
};

export function BeforeAfterSuppliers({ comparison }: Props) {
  const { before, after } = comparison;
  if (before.length === 0 && after.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No supplier comparison in this run (model omitted arrays).</p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Current baseline</h3>
        <ul className="space-y-3">
          {before.map((s) => (
            <li
              key={`${s.name}-${s.country}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2"
            >
              <div>
                <p className="font-medium text-zinc-900">{s.name}</p>
                <p className="text-xs text-zinc-500">{s.country}</p>
              </div>
              <div className="text-right">
                <RiskBadge risk={s.risk} />
                <p className="mt-1 text-xs tabular-nums text-zinc-600">{s.spendSharePercent.toFixed(1)}% share</p>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-xl border border-violet-200 bg-violet-50/30 p-4 shadow-sm"
      >
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-700">Post-shock (simulated)</h3>
        <ul className="space-y-3">
          {after.length === 0 ? (
            <li className="rounded-lg border border-dashed border-violet-200 px-3 py-4 text-sm text-violet-700/80">
              No post-shock rows returned — check JSON supplierComparison.after in the model output.
            </li>
          ) : (
            after.map((s) => (
              <li
                key={`post-${s.name}-${s.country}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2"
              >
                <div>
                  <p className="font-medium text-zinc-900">{s.name}</p>
                  <p className="text-xs text-zinc-500">{s.country}</p>
                </div>
                <div className="text-right">
                  <RiskBadge risk={s.risk} />
                  <p className="mt-1 text-xs tabular-nums text-zinc-600">
                    {s.spendSharePercent.toFixed(1)}% share
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 font-semibold ${
                        s.deltaSpendSharePercent < 0
                          ? "bg-rose-100 text-rose-700"
                          : s.deltaSpendSharePercent > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      Δ {s.deltaSpendSharePercent > 0 ? "+" : ""}
                      {s.deltaSpendSharePercent.toFixed(1)} pts
                    </span>
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </motion.div>
    </div>
  );
}
