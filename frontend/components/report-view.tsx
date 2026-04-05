import type {
  RegulatoryBullet,
  RegulatoryCitation,
  ReportResponse,
  SupplierRiskResult,
} from "@/lib/types";

/** Highest-risk suppliers first: flagged → review → clear. */
const SUPPLIER_STATUS_RANK: Record<SupplierRiskResult["status"], number> = {
  flagged: 0,
  review: 1,
  clear: 2,
};

function sortSuppliersByRisk(suppliers: SupplierRiskResult[]): SupplierRiskResult[] {
  return [...suppliers].sort((a, b) => {
    const ra = SUPPLIER_STATUS_RANK[a.status] ?? 99;
    const rb = SUPPLIER_STATUS_RANK[b.status] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.supplier_name.localeCompare(b.supplier_name, undefined, { sensitivity: "base" });
  });
}

function citeAnchorId(chunkId: string): string {
  const slug = chunkId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return `reg-cite-${slug || "source"}`;
}

function normalizeBullet(v: RegulatoryBullet | string): RegulatoryBullet {
  if (typeof v === "string") return { text: v, citation_chunk_ids: [] };
  return {
    text: v.text ?? "",
    citation_chunk_ids: Array.isArray(v.citation_chunk_ids) ? v.citation_chunk_ids : [],
  };
}

function citationSourceNumbers(citations: RegulatoryCitation[]): Map<string, number> {
  const m = new Map<string, number>();
  citations.forEach((c, i) => {
    if (c.chunk_id && !m.has(c.chunk_id)) m.set(c.chunk_id, i + 1);
  });
  return m;
}

function MatchBlock({ match }: { match: NonNullable<ReportResponse["supplier_risk"][0]["match"]> }) {
  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-ink-muted">
      <p>
        <span className="font-medium text-ink">List:</span> {match.source_list}
      </p>
      <p>
        <span className="font-medium text-ink">Matched name:</span> {match.matched_name}
      </p>
      {match.country && (
        <p>
          <span className="font-medium text-ink">Country:</span> {match.country}
        </p>
      )}
      {match.aliases.length > 0 && (
        <p className="mt-1 text-xs">
          <span className="font-medium text-ink">Aliases:</span> {match.aliases.join("; ")}
        </p>
      )}
    </div>
  );
}

function RegulatoryBulletList({
  items,
  citeNums,
}: {
  items: (RegulatoryBullet | string)[];
  citeNums: Map<string, number>;
}) {
  return (
    <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-snug text-ink-muted">
      {items.map((raw, idx) => {
        const b = normalizeBullet(raw);
        const ids = [...new Set(b.citation_chunk_ids)];
        return (
          <li key={`b-${idx}`} className="marker:text-slate-400">
            <span className="text-ink-muted">{b.text}</span>
            {ids.length > 0 && (
              <span className="text-xs text-ink-muted">
                {ids.map((cid) => {
                  const n = citeNums.get(cid);
                  if (n == null) return null;
                  return (
                    <a
                      key={cid}
                      href={`#${citeAnchorId(cid)}`}
                      className="ml-2 font-medium text-accent underline-offset-2 hover:underline"
                    >
                      Source {n}
                    </a>
                  );
                })}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ReportView({ report }: { report: ReportResponse }) {
  const citeNums = citationSourceNumbers(report.regulatory.citations);
  const suppliersOrdered = sortSuppliersByRisk(report.supplier_risk);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Section 1 — Supplier screening</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Sorted by risk: flagged first, then needs review, then clear.
        </p>
        <ul className="mt-4 divide-y divide-slate-100">
          {suppliersOrdered.map((r, idx) => (
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
              {r.fuzzy_score != null && (
                <p className="w-full text-xs text-ink-muted">Fuzzy score: {r.fuzzy_score}</p>
              )}
              {r.notes && <p className="w-full text-sm text-ink-muted">{r.notes}</p>}
              {r.match && <MatchBlock match={r.match} />}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Section 2 — Regulatory compliance</h2>
        <p className="mt-2 text-sm text-ink-muted">{report.regulatory.summary}</p>
        {report.regulatory.applicable_regulations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Applicable regulations</h3>
            <RegulatoryBulletList items={report.regulatory.applicable_regulations} citeNums={citeNums} />
          </div>
        )}
        {report.regulatory.testing_requirements.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Testing requirements</h3>
            <RegulatoryBulletList items={report.regulatory.testing_requirements} citeNums={citeNums} />
          </div>
        )}
        {(report.regulatory.estimated_compliance_cost_usd != null ||
          report.regulatory.penalty_exposure_note) && (
          <div className="mt-4 space-y-2 text-sm text-ink-muted">
            {report.regulatory.estimated_compliance_cost_usd != null && (
              <p>
                <span className="font-semibold text-ink">Estimated compliance cost (USD):</span>{" "}
                {report.regulatory.estimated_compliance_cost_usd.toLocaleString()}
              </p>
            )}
            {report.regulatory.penalty_exposure_note && (
              <p>
                <span className="font-semibold text-ink">Penalty / enforcement exposure:</span>{" "}
                {report.regulatory.penalty_exposure_note}
              </p>
            )}
          </div>
        )}
        {report.regulatory.citations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Sources</h3>
            <p className="mt-1 text-xs text-slate-500">
              Agency, document title, and page—so you can open the same guidance yourself.
            </p>
            <ul className="mt-2 space-y-2">
              {report.regulatory.citations.map((c, i) => (
                <li
                  key={`${c.document_id ?? "src"}-${i}`}
                  id={c.chunk_id ? citeAnchorId(c.chunk_id) : undefined}
                  className="scroll-mt-24 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm text-ink-muted"
                >
                  <p className="font-medium text-ink">
                    {c.chunk_id && citeNums.has(c.chunk_id) ? (
                      <span className="mr-2 text-xs font-normal text-slate-500">Source {citeNums.get(c.chunk_id)}.</span>
                    ) : null}
                    {c.title}
                  </p>
                  {c.cfr_citation && (
                    <p className="mt-1 text-xs text-slate-600">CFR: {c.cfr_citation}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
