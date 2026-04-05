"use client";

import ReactMarkdown from "react-markdown";

type Props = {
  narrative: string;
  isStreaming: boolean;
};

export function AiStreamPanel({ narrative, isStreaming }: Props) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950 p-4 text-slate-100 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isStreaming ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-500" />
            )}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live</span>
        </div>
        <span className="text-[10px] font-medium text-violet-300">Powered by Gemini</span>
      </div>
      <div className="sentinel-md max-h-[320px] overflow-y-auto pr-1 text-sm leading-relaxed text-slate-200 [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_ul]:mb-2">
        {narrative ? (
          <ReactMarkdown>{narrative}</ReactMarkdown>
        ) : (
          <p className="text-slate-500">Run a scenario to stream the analysis here…</p>
        )}
        {isStreaming && (
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-violet-400 align-middle" />
        )}
      </div>
    </div>
  );
}
