import type { RiskTier } from "@/lib/simulation-types";

const pill: Record<RiskTier, string> = {
  high: "bg-rose-100 text-rose-800 border-rose-200",
  medium: "bg-amber-100 text-amber-900 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const compact: Record<RiskTier, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-700",
};

type Props = { risk: RiskTier; variant?: "pill" | "compact" };

export function RiskBadge({ risk, variant = "pill" }: Props) {
  const cls = variant === "pill" ? pill[risk] : compact[risk];
  const base =
    variant === "pill"
      ? "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
      : "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase";
  return <span className={`${base} ${cls}`}>{risk}</span>;
}
