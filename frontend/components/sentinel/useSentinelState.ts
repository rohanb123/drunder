"use client";

import { postReport, postReportPdf } from "@/lib/api";
import type { ProfileContext, SimulationResult } from "@/lib/simulation-types";
import { streamSimulation } from "@/lib/simulation";
import type { ReportPdfRequest, ReportRequest, ReportResponse, SupplierInput } from "@/lib/types";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SentinelTab } from "./SentinelHeader";

const emptySupplier = (): SupplierInput => ({ name: "" });

const WHAT_IF_PROFILE_NAME = "What-if baseline";

const emptyBaselineRow = (): { name: string } => ({ name: "" });

function buildComplianceRequest(
  productDescription: string,
  suppliers: SupplierInput[],
): ReportRequest | null {
  const product = productDescription.trim();
  const sups = suppliers.map((s) => ({ name: s.name.trim() })).filter((s) => s.name);
  if (!product || !sups.length) return null;
  return { product_description: product, suppliers: sups };
}

export function useSentinelState() {
  const [tab, setTabInner] = useState<SentinelTab>("compliance");

  const [whatIfSuppliers, setWhatIfSuppliers] = useState([emptyBaselineRow()]);

  const [event, setEvent] = useState("");
  const [narrative, setNarrative] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [whatIfRunCompleted, setWhatIfRunCompleted] = useState(false);

  const [complianceProduct, setComplianceProduct] = useState("");
  const [complianceSuppliers, setComplianceSuppliers] = useState<SupplierInput[]>([emptySupplier()]);
  const [complianceReport, setComplianceReport] = useState<ReportResponse | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [compliancePdfLoading, setCompliancePdfLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const setTab = useCallback(
    (t: SentinelTab) => {
      if (t === "whatif" && !complianceReport) return;
      setTabInner(t);
    },
    [complianceReport],
  );

  useEffect(() => {
    if (!complianceReport && tab === "whatif") {
      setTabInner("compliance");
    }
  }, [complianceReport, tab]);

  const ctx = useMemo(
    (): ProfileContext => ({
      profileName: WHAT_IF_PROFILE_NAME,
      suppliers: whatIfSuppliers
        .map((s) => ({ name: s.name.trim(), country: "?" }))
        .filter((s) => s.name),
      htsCodes: [],
      categories: [],
    }),
    [whatIfSuppliers],
  );

  const addWhatIfSupplierRow = useCallback(() => {
    setWhatIfSuppliers((rows) => [...rows, emptyBaselineRow()]);
  }, []);

  const updateWhatIfSupplierRow = useCallback((index: number, patch: Partial<{ name: string }>) => {
    setWhatIfSuppliers((rows) => rows.map((r, j) => (j === index ? { ...r, ...patch } : r)));
  }, []);

  const removeWhatIfSupplierRow = useCallback((index: number) => {
    setWhatIfSuppliers((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== index)));
  }, []);

  const runWhatIf = useCallback(async () => {
    if (!event.trim()) return;
    setStreaming(true);
    setStreamErr(null);
    setParseErr(null);
    setResult(null);
    setNarrative("");
    try {
      const out = await streamSimulation(event.trim(), ctx, (buf) => {
        const idx = buf.indexOf("<<<SIM_JSON>>>");
        setNarrative(idx === -1 ? buf : buf.slice(0, idx).trimEnd());
      });
      setNarrative(out.narrative);
      if (out.streamError) setStreamErr(out.streamError);
      if (out.parseError) setParseErr(out.parseError);
      if (out.result) setResult(out.result);
    } catch (e) {
      setStreamErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setStreaming(false);
      setWhatIfRunCompleted(true);
    }
  }, [ctx, event]);

  const addComplianceSupplierRow = useCallback(() => {
    setComplianceSuppliers((rows) => [...rows, emptySupplier()]);
  }, []);

  const updateComplianceSupplierRow = useCallback((index: number, patch: Partial<SupplierInput>) => {
    setComplianceSuppliers((rows) => rows.map((r, j) => (j === index ? { ...r, ...patch } : r)));
  }, []);

  const removeComplianceSupplierRow = useCallback((index: number) => {
    setComplianceSuppliers((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== index)));
  }, []);

  const onComplianceCsv = useCallback((file: File | null) => {
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
          .map((row) => ({
            name: (row.name ?? row.supplier_name ?? row.Supplier ?? "").trim(),
          }))
          .filter((r) => r.name);
        if (rows.length) setComplianceSuppliers(rows);
      },
    });
  }, []);

  const runComplianceReport = useCallback(async () => {
    setComplianceError(null);
    const body = buildComplianceRequest(complianceProduct, complianceSuppliers);
    if (!body) {
      setComplianceError("Add a product description and at least one supplier name.");
      return;
    }
    setComplianceLoading(true);
    try {
      const r = await postReport(body);
      setComplianceReport(r);
      const fromReport = r.supplier_risk
        .map((x) => ({ name: x.supplier_name.trim() }))
        .filter((x) => x.name);
      setWhatIfSuppliers(fromReport.length ? fromReport : [emptyBaselineRow()]);
    } catch (e) {
      setComplianceError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setComplianceLoading(false);
    }
  }, [complianceProduct, complianceSuppliers]);

  const downloadCompliancePdf = useCallback(async () => {
    setComplianceError(null);
    const body = buildComplianceRequest(complianceProduct, complianceSuppliers);
    if (!body) {
      setComplianceError("Add a product description and at least one supplier name.");
      return;
    }
    setCompliancePdfLoading(true);
    try {
      const blob = await postReportPdf(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clearpath-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setComplianceError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setCompliancePdfLoading(false);
    }
  }, [complianceProduct, complianceSuppliers]);

  const downloadUnifiedPdf = useCallback(async () => {
    setComplianceError(null);
    const body = buildComplianceRequest(complianceProduct, complianceSuppliers);
    if (!body) {
      setComplianceError("Add a product description and at least one supplier name.");
      return;
    }
    const payload: ReportPdfRequest = {
      ...body,
      what_if: {
        scenario_prompt: event.trim(),
        narrative: narrative.trim(),
        compliance_blockers: (result?.complianceBlockers ?? []).map((b) => ({
          title: b.title,
          detail: b.detail,
          severity: b.severity,
        })),
      },
    };
    setCompliancePdfLoading(true);
    try {
      const blob = await postReportPdf(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clearpath-unified-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setComplianceError(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setCompliancePdfLoading(false);
    }
  }, [complianceProduct, complianceSuppliers, event, narrative, result]);

  const requestUnifiedPdf = useCallback(() => {
    void downloadUnifiedPdf();
  }, [downloadUnifiedPdf]);

  const clearComplianceReport = useCallback(() => {
    setComplianceReport(null);
    setComplianceError(null);
    setComplianceProduct("");
    setComplianceSuppliers([emptySupplier()]);
    setWhatIfSuppliers([emptyBaselineRow()]);
    setEvent("");
    setNarrative("");
    setResult(null);
    setStreamErr(null);
    setParseErr(null);
    setWhatIfRunCompleted(false);
  }, []);

  return {
    tab,
    setTab,
    whatIfSuppliers,
    addWhatIfSupplierRow,
    updateWhatIfSupplierRow,
    removeWhatIfSupplierRow,
    event,
    setEvent,
    narrative,
    streaming,
    result,
    streamErr,
    parseErr,
    runWhatIf,
    complianceProduct,
    setComplianceProduct,
    complianceSuppliers,
    addComplianceSupplierRow,
    updateComplianceSupplierRow,
    removeComplianceSupplierRow,
    onComplianceCsv,
    complianceReport,
    clearComplianceReport,
    complianceLoading,
    compliancePdfLoading,
    complianceError,
    runComplianceReport,
    downloadCompliancePdf,
    requestUnifiedPdf,
    whatIfRunCompleted,
  };
}
