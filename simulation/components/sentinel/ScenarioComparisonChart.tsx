"use client";

import type { StackedScenario } from "@/lib/simulation-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  scenarios: StackedScenario[];
};

export function ScenarioComparisonChart({ scenarios }: Props) {
  if (scenarios.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white text-sm text-zinc-400">
        Pin up to 3 scenarios from the What-If tab to compare margin impact.
      </div>
    );
  }

  const data = scenarios.map((s) => ({
    name: s.label.length > 22 ? `${s.label.slice(0, 20)}…` : s.label,
    margin: s.marginImpactPercent,
    fill: s.color,
  }));

  return (
    <div className="h-64 w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Stacked what-ifs — margin (pts)
      </p>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} interval={0} angle={-12} height={48} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
          <Tooltip
            formatter={(v) => [`${Number(v ?? 0).toFixed(1)} pts`, "Margin"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7" }}
          />
          <Bar dataKey="margin" radius={[6, 6, 0, 0]}>
            {data.map((e, i) => (
              <Cell key={i} fill={e.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
