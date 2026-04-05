export type SentinelTab = "compliance" | "whatif";

type Props = {
  tab: SentinelTab;
  onTab: (t: SentinelTab) => void;
  /** When false, the What-If tab is hidden until a compliance report has been generated. */
  whatIfUnlocked: boolean;
};

export function SentinelHeader({ tab, onTab, whatIfUnlocked }: Props) {
  const tabs: { id: SentinelTab; label: string }[] = [
    { id: "compliance", label: "Compliance report" },
    ...(whatIfUnlocked ? [{ id: "whatif" as const, label: `"What-If" simulator` }] : []),
  ];
  return (
    <header className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Clearpath + Supply Chain Sentinel</h1>
          <p className="text-xs text-zinc-500">Compliance reports and what-if simulation</p>
        </div>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-1 px-6">
        {tabs.map(({ id, label }) => (
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
