"use client";

import { ReportView } from "@/components/report-view";
import type { ReportResponse, SupplierInput } from "@/lib/types";

type SupplierRow = SupplierInput;

const EXAMPLE_PRODUCT =
  "Steel water bottles with bamboo lids, sold in US retail channels. Manufactured in China and Vietnam, co-packed in Mexico.";

const EXAMPLE_SUPPLIERS: SupplierInput[] = [
  { name: "Zhejiang Metal Works Co.", role: "Primary manufacturer of stainless steel bottle bodies" },
  { name: "Nguyen Packaging Ltd", role: "Vietnamese co-manufacturer for bamboo lid assembly" },
  { name: "Baja Co-Pack S.A.", role: "Mexican co-packer for final assembly and labeling" },
  { name: "SinoChem Trading", role: "Chemicals supplier for surface coating and lacquers" },
];

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
  function loadExample() {
    setProductDescription(EXAMPLE_PRODUCT);
    // Replace all rows with example suppliers
    // We do this by updating each existing row then adding new ones
    EXAMPLE_SUPPLIERS.forEach((s, i) => updateSupplierRow(i, s));
    // Add remaining rows if needed (we have 4 examples, default starts with 1)
    for (let i = suppliers.length; i < EXAMPLE_SUPPLIERS.length; i++) {
      addSupplierRow();
    }
  }

  return (
    <div className="space-y-8">
      {!report && (
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-surface-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Compliance report</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Sanctions screening · Regulatory analysis · Supply chain mapping
              </p>
            </div>
            <button
              type="button"
              onClick={loadExample}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
            >
              Try example
            </button>
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
              placeholder="e.g. Cold-brew coffee concentrate in glass bottles, US nationwide…"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">
                Suppliers to screen{" "}
                <span className="font-normal text-ink-muted">(name and short description / role required)</span>
              </span>
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
            <div className="mt-3 space-y-4">
              {suppliers.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`supplier-name-${i}`}
                        className="mb-1 block text-xs font-medium text-ink-muted"
                      >
                        Supplier name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id={`supplier-name-${i}`}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder="Legal or trade name"
                        value={s.name}
                        onChange={(e) => updateSupplierRow(i, { name: e.target.value })}
                        aria-required
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSupplierRow(i)}
                      className="shrink-0 pb-2 text-sm text-slate-500 hover:text-red-600 sm:w-16 sm:text-right"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 border-l-2 border-slate-200 pl-4 sm:pl-5">
                    <label
                      htmlFor={`supplier-role-${i}`}
                      className="mb-1 block text-xs font-medium text-ink-muted"
                    >
                      Short description / role <span className="text-red-600">*</span>
                    </label>
                    <input
                      id={`supplier-role-${i}`}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm shadow-sm focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                      placeholder="Required — what they do (e.g. raw silicone manufacturer, co-packer, freight forwarder)"
                      value={s.role}
                      onChange={(e) => updateSupplierRow(i, { role: e.target.value })}
                      aria-required
                    />
                  </div>
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
