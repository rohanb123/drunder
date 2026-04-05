export type SentinelTab = "compliance" | "whatif";

const TABS: { id: SentinelTab; label: string }[] = [
  { id: "compliance", label: "Compliance report" },
  { id: "whatif", label: `"What-If" simulator` },
];

type Props = {
  tab: SentinelTab;
  onTab: (t: SentinelTab) => void;
  onUnifiedPdf: () => void;
  unifiedPdfBusy?: boolean;
};

export function SentinelHeader({ tab, onTab, onUnifiedPdf, unifiedPdfBusy = false }: Props) {
  return (
    <header className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Clearpath + Supply Chain Sentinel</h1>
          <p className="text-xs text-zinc-500">Compliance reports and what-if simulation</p>
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
