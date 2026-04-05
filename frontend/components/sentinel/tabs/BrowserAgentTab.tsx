"use client";

import { useEffect, useRef, useState } from "react";
import { baseUrl } from "@/lib/api";

type AgentStatus = "idle" | "running" | "done" | "error";

const TOTAL_STEPS = 6;

type Props = {
  initialCompany?: string;
  initialNote?: string;
};

export function BrowserAgentTab({ initialCompany = "", initialNote = "" }: Props) {
  const [company, setCompany] = useState(initialCompany);
  const [note, setNote] = useState(initialNote);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync pre-fill when props change (e.g. user clicks "Take action" from report)
  useEffect(() => {
    if (initialCompany) setCompany(initialCompany);
    if (initialNote) setNote(initialNote);
    if (initialCompany || initialNote) setStatus("idle");
  }, [initialCompany, initialNote]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !note.trim()) return;

    setStatus("running");
    setLiveUrl(null);
    setStepIndex(0);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${baseUrl()}/browser-agent/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), note: note.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.statusText}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventMatch = block.match(/^event: (\w+)/m);
          const dataMatch = block.match(/^data: (.+)/m);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          let data: string;
          try {
            data = JSON.parse(dataMatch[1]) as string;
          } catch {
            data = dataMatch[1];
          }

          if (event === "status") {
            setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS - 1));
          } else if (event === "live_url") {
            setLiveUrl(data);
          } else if (event === "done") {
            setStatus("done");
            setStepIndex(TOTAL_STEPS);
          } else if (event === "error") {
            setError(data);
            setStatus("error");
          }
        }
      }

      if (status !== "done" && status !== "error") {
        setStatus("done");
        setStepIndex(TOTAL_STEPS);
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }

  function handleReset() {
    abortRef.current?.abort();
    setStatus("idle");
    setLiveUrl(null);
    setStepIndex(0);
    setError(null);
  }

  const progressPct = status === "done" ? 100 : Math.round((stepIndex / TOTAL_STEPS) * 100);

  return (
    <div className="space-y-6">
      {/* Form card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Dashboard Agent</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Provide a supplier name and context — the agent will update the supply chain dashboard automatically.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-5">
          <div>
            <label htmlFor="agent-company" className="block text-sm font-medium text-zinc-700">
              Supplier name
            </label>
            <input
              id="agent-company"
              type="text"
              required
              disabled={status === "running"}
              placeholder="e.g. Iberian Packaging Solutions"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="agent-note" className="block text-sm font-medium text-zinc-700">
              Summary / context
            </label>
            <textarea
              id="agent-note"
              rows={4}
              required
              disabled={status === "running"}
              placeholder="e.g. Delayed 3 shipments this quarter, quality issues on last order. U.S. sanctions concern."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={status === "running" || !company.trim() || !note.trim()}
              className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50"
            >
              {status === "running" ? "Running…" : "Run agent"}
            </button>
            {status !== "idle" && (
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Progress card */}
      {status !== "idle" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {status === "done" ? "Complete" : status === "error" ? "Failed" : "Agent working…"}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  status === "error" ? "bg-red-500" : status === "done" ? "bg-emerald-500" : "bg-violet-500"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Live URL */}
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-700 hover:bg-violet-100"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Watch live browser session →
            </a>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {/* Success banner */}
          {status === "done" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-lg">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Successfully updated supply dashboard</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Internal note added and supplier message sent for{" "}
                    <span className="font-medium">{company}</span>.
                  </p>
                </div>
              </div>
              {note && (
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Context sent</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
