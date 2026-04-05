"use client";

import { ClearpathReportView } from "@/components/clearpath/ClearpathReportView";
import type { ReportResponse } from "@/lib/clearpath/types";

type SupplierRow = { name: string };

type Props = {
  productDescription: string;
  setProductDescription: (v: string) => void;
  suppliers: SupplierRow[];
  addSupplierRow: () => void;
  updateSupplierRow: (index: number, patch: Partial<SupplierRow>) => void;
  removeSupplierRow: (index: number) => void;
  loadSuppliersFromProfile: () => void;
  canLoadFromProfile: boolean;
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
  loadSuppliersFromProfile,
  canLoadFromProfile,
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Compliance report</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sanctions screening and U.S. regulatory guidance via your Clearpath API. Uses the same inputs as the
            standalone Clearpath app.
          </p>

          {complianceError && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {complianceError}
            </p>
          )}

          <div className="mt-6">
            <label htmlFor="compliance-product" className="block text-sm font-medium text-zinc-800">
              Product description
            </label>
            <textarea
              id="compliance-product"
              rows={4}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              placeholder="e.g. Silicone teething toy for infants, sold in retail blister packs…"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-800">Suppliers to screen</span>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
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
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Add row
                </button>
                <button
                  type="button"
                  disabled={!canLoadFromProfile}
                  onClick={loadSuppliersFromProfile}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Load from active profile
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              CSV column: <code className="rounded bg-zinc-100 px-1">name</code> (or{" "}
              <code className="rounded bg-zinc-100 px-1">supplier_name</code>).
            </p>
            <div className="mt-3 space-y-3">
              {suppliers.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    placeholder="Supplier name"
                    value={s.name}
                    onChange={(e) => updateSupplierRow(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeSupplierRow(i)}
                    className="text-sm text-zinc-500 hover:text-rose-600 sm:w-16"
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
            className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-violet-500 disabled:opacity-60"
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
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              New report
            </button>
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={compliancePdfLoading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {compliancePdfLoading ? "PDF…" : "Download PDF"}
            </button>
          </div>
          {complianceError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {complianceError}
            </p>
          )}
          <ClearpathReportView report={report} />
        </div>
      )}
    </div>
  );
}
