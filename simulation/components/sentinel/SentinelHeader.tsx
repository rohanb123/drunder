export type SentinelTab = "profile" | "whatif" | "radar" | "compliance";

const TABS: { id: SentinelTab; label: string }[] = [
  { id: "profile", label: "Supply chain profile" },
  { id: "whatif", label: `"What-If" simulator` },
  { id: "radar", label: "Risk radar" },
  { id: "compliance", label: "Compliance report" },
];

type Props = {
  supplierCount: number;
  highRiskCount: number;
  tab: SentinelTab;
  onTab: (t: SentinelTab) => void;
  onUnifiedPdf: () => void;
  unifiedPdfBusy?: boolean;
};

export function SentinelHeader({
  supplierCount,
  highRiskCount,
  tab,
  onTab,
  onUnifiedPdf,
  unifiedPdfBusy = false,
}: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Supply Chain Sentinel</h1>
          <p className="text-xs text-zinc-500">Intelligence-led risk management & simulation engine</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Suppliers</p>
            <p className="text-lg font-bold text-violet-600">{supplierCount}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">High risk</p>
            <p className="text-lg font-bold text-rose-600">{highRiskCount}</p>
          </div>
          <button
            type="button"
            disabled={unifiedPdfBusy}
            onClick={onUnifiedPdf}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-violet-500 disabled:opacity-60"
          >
            <span aria-hidden>📄</span>
            {unifiedPdfBusy ? "PDF…" : "Generate unified PDF"}
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 px-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === id
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
