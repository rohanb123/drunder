"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Row = { country: string; value: number };

type Props = {
  byCountry: Row[];
};

const COLORS = ["#7c3aed", "#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#94a3b8"];

export function ExposureSnapshot({ byCountry }: Props) {
  if (byCountry.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xs text-zinc-400">
        Add suppliers to see geographic exposure.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Exposure snapshot</p>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={byCountry} dataKey="value" nameKey="country" cx="50%" cy="50%" innerRadius={48} outerRadius={72}>
              {byCountry.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, "Share"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1.5">
        {byCountry.map((r) => (
          <li key={r.country} className="flex items-center justify-between text-xs">
            <span className="text-zinc-600">{r.country}</span>
            <span className="font-mono font-medium tabular-nums text-zinc-900">{r.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
