"use client";

import { ReportView } from "@/components/report-view";
import type { ReportResponse } from "@/lib/types";

type SupplierRow = { name: string };

type Props = {
  productDescription: string;
  setProductDescription: (v: string) => void;
  suppliers: SupplierRow[];
  addSupplierRow: () => void;
  updateSupplierRow: (index: number, patch: Partial<SupplierRow>) => void;
  removeSupplierRow: (index: number) => void;
  onComplianceCsv: (file: File | null) => void;
  report: ReportResponse | null;
  clearReport: () => void;
  complianceLoading: boolean;
  compliancePdfLoading: boolean;
  complianceError: string | null;
  onGenerateReport: () => void;
  onDownloadPdf: () => void;
};

export function ComplianceTab({
  productDescription,
  setProductDescription,
  suppliers,
  addSupplierRow,
  updateSupplierRow,
  removeSupplierRow,
  onComplianceCsv,
  report,
  clearReport,
  complianceLoading,
  compliancePdfLoading,
  complianceError,
  onGenerateReport,
  onDownloadPdf,
}: Props) {
  return (
    <div className="space-y-8">
      {!report && (
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-surface-card p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-ink">Compliance report</h2>
          </div>

          {complianceError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {complianceError}
            </p>
          )}

          <div>
            <label htmlFor="compliance-product" className="block text-sm font-medium text-ink">
              Product description
            </label>
            <textarea
              id="compliance-product"
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder='e.g. Cold-brew coffee concentrate in glass bottles, US nationwide…'
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">Suppliers to screen</span>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      onComplianceCsv(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={addSupplierRow}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Add row
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              CSV: <code className="rounded bg-slate-100 px-1">name</code> or{" "}
              <code className="rounded bg-slate-100 px-1">supplier_name</code>.
            </p>
            <div className="mt-3 space-y-3">
              {suppliers.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Supplier name"
                    value={s.name}
                    onChange={(e) => updateSupplierRow(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeSupplierRow(i)}
                    className="text-sm text-slate-500 hover:text-red-600 sm:w-16"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerateReport}
            disabled={complianceLoading}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow hover:bg-accent-hover disabled:opacity-60"
          >
            {complianceLoading ? "Building report…" : "Generate report"}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={clearReport}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              New report
            </button>
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={compliancePdfLoading}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {compliancePdfLoading ? "PDF…" : "Download PDF"}
            </button>
          </div>
          {complianceError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {complianceError}
            </p>
          )}
          <ReportView report={report} />
        </div>
      )}
    </div>
  );
}
