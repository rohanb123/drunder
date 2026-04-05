"use client";

import { getCentroid } from "@/lib/country-centroids";
import type { PivotRoute } from "@/lib/simulation-types";
import { motion } from "framer-motion";
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Props = {
  pivots: PivotRoute[];
};

export function PivotMap({ pivots }: Props) {
  const routes = pivots
    .map((p) => {
      const from = getCentroid(p.fromCountry);
      const to = getCentroid(p.toCountry);
      if (!from || !to) return null;
      return { ...p, from, to };
    })
    .filter(Boolean) as (PivotRoute & { from: [number, number]; to: [number, number] })[];

  if (routes.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-400">
        No routable pivots (add ISO2 fromCountry / toCountry in model output).
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-inner">
      <ComposableMap
        projectionConfig={{ scale: 140, center: [0, 20] }}
        width={800}
        height={360}
        className="mx-auto w-full max-h-[320px]"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Record<string, unknown>[] }) =>
            geographies.map((geo) => (
              <Geography
                key={String(geo.rsmKey)}
                geography={geo}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={0.4}
                style={{ default: { outline: "none" }, hover: { outline: "none" } }}
              />
            ))
          }
        </Geographies>
        {routes.map((r, i) => (
          <g key={`${r.fromCountry}-${r.toCountry}-${i}`}>
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.15 }}>
              <Line
                from={r.from}
                to={r.to}
                stroke="#a855f7"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="6 4"
              />
            </motion.g>
            <Marker coordinates={r.from}>
              <circle r={5} fill="#f87171" stroke="#fff" strokeWidth={1} />
            </Marker>
            <Marker coordinates={r.to}>
              <circle r={5} fill="#4ade80" stroke="#fff" strokeWidth={1} />
            </Marker>
          </g>
        ))}
      </ComposableMap>
      <div className="flex flex-wrap gap-3 border-t border-slate-700 bg-slate-950/80 px-3 py-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-400" /> Origin
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-400" /> Pivot target
        </span>
        {routes.map((r) => (
          <span key={r.title} className="text-violet-300">
            {r.fromCountry} → {r.toCountry}
          </span>
        ))}
      </div>
    </div>
  );
}
