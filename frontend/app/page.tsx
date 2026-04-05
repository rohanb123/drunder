"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import { ReportView } from "@/components/report-view";
import { postReport, postReportPdf } from "@/lib/api";
import type { ReportRequest, ReportResponse, SupplierInput } from "@/lib/types";

const emptySupplier = (): SupplierInput => ({ name: "" });

/** Normalize CSV header for matching (BOM, case, underscores, spaces). */
function normalizeCsvHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

/** Normalized tokens that indicate a header row (not a supplier name). */
const CSV_HEADER_TOKENS = new Set([
  "name",
  "supplier",
  "supplier name",
  "vendor",
  "company",
  "legal name",
  "vendor name",
  "company name",
  "business name",
  "entity name",
  "country",
  "country of origin",
  "notes",
  "email",
  "phone",
  "website",
]);

function csvCellLooksLikeHeader(cell: string): boolean {
  const t = normalizeCsvHeader(cell);
  if (!t) return true;
  return CSV_HEADER_TOKENS.has(t);
}

/** True if the first row is clearly column titles, not the first supplier line. */
function csvFirstRowIsHeader(row: string[]): boolean {
  const cells = row.map((c) => c.replace(/^\uFEFF/, "").trim()).filter((c) => c.length > 0);
  if (cells.length === 0) return false;
  return cells.every((c) => csvCellLooksLikeHeader(c));
}

/** Pick supplier name cell from one CSV row; supports common export column names. */
function nameFromCsvRow(row: Record<string, string>): string {
  const map = new Map<string, string>();
  for (const [rawK, rawV] of Object.entries(row)) {
    const key = normalizeCsvHeader(rawK);
    const val = typeof rawV === "string" ? rawV.trim() : String(rawV ?? "").trim();
    if (!key) continue;
    map.set(key, val);
  }
  const prefer = [
    "supplier name",
    "name",
    "supplier",
    "vendor",
    "company",
    "legal name",
    "vendor name",
    "company name",
    "business name",
    "entity name",
  ];
  for (const k of prefer) {
    const v = map.get(k);
    if (v) return v;
  }
  for (const [k, v] of Array.from(map.entries())) {
    if (!v) continue;
    if (k.includes("supplier") && k.includes("name")) return v;
  }
  for (const v of Array.from(map.values())) {
    if (v) return v;
  }
  return "";
}

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
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: "greedy",
      complete: (results) => {
        const raw = results.data as string[][];
        if (!raw.length) return;

        const dataRows: SupplierInput[] = [];
        let start = 0;
        let headerKeys: string[] | null = null;

        if (csvFirstRowIsHeader(raw[0])) {
          headerKeys = raw[0].map((h, j) => {
            const t = h.replace(/^\uFEFF/, "").trim();
            return t || `column_${j}`;
          });
          start = 1;
        }

        for (let i = start; i < raw.length; i++) {
          const line = raw[i];
          if (!line || !line.some((c) => String(c ?? "").trim())) continue;

          if (headerKeys) {
            const row: Record<string, string> = {};
            headerKeys.forEach((key, j) => {
              row[key] = String(line[j] ?? "").trim();
            });
            const name = nameFromCsvRow(row);
            if (name) dataRows.push({ name });
          } else {
            const name =
              line
                .map((c) => String(c ?? "").replace(/^\uFEFF/, "").trim())
                .find((c) => c.length > 0) ?? "";
            if (name) dataRows.push({ name });
          }
        }

        if (dataRows.length) setSuppliers(dataRows);
      },
    });
  }, []);

  const buildRequest = (): ReportRequest => ({
    product_description: productDescription.trim(),
    suppliers: suppliers.map((s) => ({ name: s.name.trim() })).filter((s) => s.name),
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

  const resetForm = () => {
    setProductDescription("");
    setSuppliers([emptySupplier()]);
    setError(null);
    setLoading(false);
    setPdfLoading(false);
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
          One report. Sanctions screening and regulatory guidance.
        </h1>
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
              placeholder='e.g. Cold-brew coffee concentrate in glass bottles, US nationwide, label with caffeine and "natural flavors".'
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
            <div className="mt-3 space-y-3">
              {suppliers.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    placeholder="Supplier name"
                    value={s.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
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
              onClick={() => {
                setReport(null);
                resetForm();
              }}
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
