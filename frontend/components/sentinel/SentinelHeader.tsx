export type SentinelTab = "compliance" | "supplychain" | "browser";

type Props = {
  tab: SentinelTab;
  onTab: (t: SentinelTab) => void;
  reportTabsUnlocked: boolean;
};

export function SentinelHeader({ tab, onTab, reportTabsUnlocked }: Props) {
  const tabs: { id: SentinelTab; label: string }[] = [
    { id: "compliance", label: "Compliance Report" },
    ...(reportTabsUnlocked ? [{ id: "supplychain" as const, label: "Supply Chain" }] : []),
    { id: "browser", label: "Dashboard Agent" },
  ];

  return (
    <header className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            Clearpath
            <span className="ml-2 text-violet-600">·</span>
            <span className="ml-2 text-zinc-500 font-medium">Supply Chain Intelligence</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Real-time sanctions screening · Regulatory RAG · AI disruption simulation · Autonomous browser agent
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
          Live
        </span>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-0 px-6">
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
