import { useEffect, useState } from "react";
import { regulatorySourcePdfUrl } from "@/lib/api";
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

function sourceLinkForChunk(citations: RegulatoryCitation[], chunkId: string): string | null {
  const c = citations.find((x) => x.chunk_id === chunkId);
  if (!c) return null;
  return regulatorySourcePdfUrl(c.source_file, c.source_page);
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
  citations,
}: {
  items: (RegulatoryBullet | string)[];
  citeNums: Map<string, number>;
  citations: RegulatoryCitation[];
}) {
  return (
    <ul className="mt-2 list-inside list-disc space-y-2 text-sm leading-snug text-ink-muted">
      {items.map((raw, idx) => {
        const b = normalizeBullet(raw);
        const ids = Array.from(new Set(b.citation_chunk_ids));
        return (
          <li key={`b-${idx}`} className="marker:text-slate-400">
            <span className="text-ink-muted">{b.text}</span>
            {ids.length > 0 && (
              <span className="text-xs text-ink-muted">
                {ids.map((cid) => {
                  const n = citeNums.get(cid);
                  if (n == null) return null;
                  const pdfHref = sourceLinkForChunk(citations, cid);
                  const inPage = `#${citeAnchorId(cid)}`;
                  const href = pdfHref ?? inPage;
                  const external = Boolean(pdfHref);
                  return (
                    <a
                      key={cid}
                      href={href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    const expandIfHashTargetsSource = () => {
      const raw = window.location.hash.slice(1);
      if (!raw || !raw.startsWith("reg-cite-")) return;
      const el = document.getElementById(raw);
      if (!el) return;
      const panel = el.closest("[data-sources-panel]");
      if (panel instanceof HTMLDetailsElement && !panel.open) {
        setSourcesOpen(true);
      }
    };
    expandIfHashTargetsSource();
    window.addEventListener("hashchange", expandIfHashTargetsSource);
    return () => window.removeEventListener("hashchange", expandIfHashTargetsSource);
  }, [report.regulatory.citations]);

  useEffect(() => {
    setSourcesOpen(false);
  }, [report.product_description, report.regulatory.citations.length]);

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
              <div className="min-w-0 flex-1">
                <span className="font-medium text-ink">{r.supplier_name}</span>
                {(r.role ?? "").trim() ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Description / role: {(r.role ?? "").trim()}
                  </p>
                ) : null}
              </div>
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
            <RegulatoryBulletList
              items={report.regulatory.applicable_regulations}
              citeNums={citeNums}
              citations={report.regulatory.citations}
            />
          </div>
        )}
        {report.regulatory.testing_requirements.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">Testing requirements</h3>
            <RegulatoryBulletList
              items={report.regulatory.testing_requirements}
              citeNums={citeNums}
              citations={report.regulatory.citations}
            />
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
          <details
            data-sources-panel
            className="group/sources mt-4 rounded-xl border border-slate-200 bg-white shadow-sm open:shadow-md"
            open={sourcesOpen}
            onToggle={(e) => setSourcesOpen(e.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-baseline gap-x-2">
                Sources
                <span className="font-normal text-xs text-slate-500">
                  ({report.regulatory.citations.length}) — tap to expand or collapse
                </span>
              </span>
              <svg
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${sourcesOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="border-t border-slate-100 px-4 pb-4 pt-1">
              <p className="text-xs text-slate-500">
                Agency, document title, and page. Use the link to open the original PDF (starts at the cited page when
                available).
              </p>
              <ul className="mt-3 space-y-2">
                {report.regulatory.citations.map((c, i) => {
                  const pdfHref = regulatorySourcePdfUrl(c.source_file, c.source_page);
                  return (
                    <li
                      key={`${c.document_id ?? "src"}-${i}`}
                      id={c.chunk_id ? citeAnchorId(c.chunk_id) : undefined}
                      className="scroll-mt-24 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm text-ink-muted"
                    >
                      <p className="font-medium text-ink">
                        {c.chunk_id && citeNums.has(c.chunk_id) ? (
                          <span className="mr-2 text-xs font-normal text-slate-500">
                            Source {citeNums.get(c.chunk_id)}.
                          </span>
                        ) : null}
                        {pdfHref ? (
                          <a
                            href={pdfHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {c.title}
                          </a>
                        ) : (
                          c.title
                        )}
                      </p>
                      {c.cfr_citation && (
                        <p className="mt-1 text-xs text-slate-600">CFR: {c.cfr_citation}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}
