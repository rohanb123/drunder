"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import { ReportView } from "@/components/report-view";
import { postReport, postReportPdf } from "@/lib/api";
import type { ReportRequest, ReportResponse, SupplierInput } from "@/lib/types";

const emptySupplier = (): SupplierInput => ({ name: "", country_of_origin: "" });

export default function HomePage() {
  const [productDescription, setProductDescription] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierInput[]>([emptySupplier()]);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const addRow = () => setSuppliers((s) => [...s, emptySupplier()]);
  const updateRow = (i: number, patch: Partial<SupplierInput>) => {
    setSuppliers((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i: number) => {
    setSuppliers((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== i)));
  };

  const onCsvUpload = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
          .map((row) => ({
            name: (row.name ?? row.supplier_name ?? row.Supplier ?? "").trim(),
            country_of_origin: (row.country_of_origin ?? row.country ?? row.origin ?? "").trim(),
          }))
          .filter((r) => r.name || r.country_of_origin);
        if (rows.length) setSuppliers(rows);
      },
    });
  }, []);

  const buildRequest = (): ReportRequest => ({
    product_description: productDescription.trim(),
    suppliers: suppliers
      .map((s) => ({
        name: s.name.trim(),
        country_of_origin: s.country_of_origin.trim(),
      }))
      .filter((s) => s.name),
  });

  const submit = async () => {
    setError(null);
    const body = buildRequest();
    if (!body.product_description) {
      setError("Add a product description.");
      return;
    }
    if (!body.suppliers.length) {
      setError("Add at least one supplier with a name.");
      return;
    }
    setLoading(true);
    try {
      const r = await postReport(body);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    setError(null);
    const body = buildRequest();
    setPdfLoading(true);
    try {
      const blob = await postReportPdf(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clearpath-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Clearpath</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">
          One report. Sanctions, tariffs, regulations.
        </h1>
        <p className="mt-3 max-w-2xl text-ink-muted">
          Describe your product and list suppliers. You get a single JSON report with three sections
          — and optional PDF export for filing or sharing.
        </p>
      </header>

      {!report && (
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-surface-card p-6 shadow-sm">
          <div>
            <label htmlFor="product" className="block text-sm font-medium text-ink">
              Product description
            </label>
            <textarea
              id="product"
              rows={4}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="e.g. Silicone teething toy for infants, sold in retail blister packs…"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">Suppliers</span>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onCsvUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-slate-50"
                >
                  Add row
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              CSV headers: <code className="rounded bg-slate-100 px-1">name</code>,{" "}
              <code className="rounded bg-slate-100 px-1">country_of_origin</code> (aliases: supplier_name,
              country, origin).
            </p>
            <div className="mt-3 space-y-3">
              {suppliers.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Supplier name"
                    value={s.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                  />
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Country of origin"
                    value={s.country_of_origin}
                    onChange={(e) => updateRow(i, { country_of_origin: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-sm text-slate-500 hover:text-red-600 sm:w-16"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Building report…" : "Generate report"}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReport(null)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              New report
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {pdfLoading ? "PDF…" : "Download PDF"}
            </button>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <ReportView report={report} />
        </div>
      )}
    </main>
  );
}
