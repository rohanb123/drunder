import type { SimulationResult } from "@/lib/simulation-types";

type Item = SimulationResult["complianceBlockers"][number];

type Props = {
  items: Item[];
  variant?: "cards" | "inline";
  title?: string;
};

export function ComplianceList({ items, variant = "cards", title }: Props) {
  if (items.length === 0) return null;
  if (variant === "inline") {
    return (
      <ul className="space-y-2">
        {items.map((b, i) => (
          <li key={i} className="text-sm text-zinc-700">
            <strong>{b.title}</strong> — {b.detail}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title && <h3 className="mb-2 text-xs font-bold uppercase text-zinc-500">{title}</h3>}
      <ul className="space-y-2 text-sm">
        {items.map((b, i) => (
          <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2">
            <span className="font-medium">{b.title}</span>
            <p className="text-xs text-zinc-600">{b.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
