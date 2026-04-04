import type { ReportResponse } from "@/lib/types";

export function ReportView({ report }: { report: ReportResponse }) {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Section 1 — Supplier risk</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Consolidated Screening List + fuzzy matching (stub until APIs are wired).
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {report.supplier_risk.map((r, idx) => (
            <li key={`${r.supplier_name}-${idx}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span className="font-medium text-ink">{r.supplier_name}</span>
              <span
                className={
                  r.status === "flagged"
                    ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800"
                    : r.status === "review"
                      ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                }
              >
                {r.status}
              </span>
              {r.notes && <p className="w-full text-sm text-ink-muted">{r.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Section 2 — Tariff exposure</h2>
        <p className="mt-1 text-sm text-ink-muted">
          HTS chapter (Gemini) + Trade.gov Tariff Rates API per country of origin.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {report.tariff_exposure.map((t, idx) => (
            <li key={`${t.supplier_name}-${idx}`} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{t.supplier_name}</span>
                <span className="text-sm text-ink-muted">
                  HTS ch. {t.hts_chapter}
                  {t.duty_rate_percent != null ? ` · ${t.duty_rate_percent}%` : ""}
                </span>
              </div>
              <p className="text-sm text-ink-muted">Origin: {t.country_of_origin}</p>
              <p className="text-xs text-slate-400">{t.api_source}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Section 3 — Regulatory compliance</h2>
        <p className="mt-2 text-sm text-ink-muted">{report.regulatory.summary}</p>
        {report.regulatory.applicable_regulations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Applicable regulations</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-ink-muted">
              {report.regulatory.applicable_regulations.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {report.regulatory.citations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Citations</h3>
            <ul className="mt-2 space-y-2">
              {report.regulatory.citations.map((c, i) => (
                <li key={`${c.title}-${i}`} className="text-sm text-ink-muted">
                  <span className="font-medium text-ink">{c.source}</span> — {c.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
