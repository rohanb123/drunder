"use client";

import { postReport, postReportPdf } from "@/lib/api";
import type {
  ReportRequest,
  ReportResponse,
  SupplierInput,
  SupplyChainAnalysis,
} from "@/lib/types";
import Papa from "papaparse";
import { useCallback, useEffect, useState } from "react";
import type { SentinelTab } from "./SentinelHeader";

const emptySupplier = (): SupplierInput => ({ name: "", role: "" });

function complianceRequestError(productDescription: string, suppliers: SupplierInput[]): string | null {
  const product = productDescription.trim();
  if (!product) return "Add a product description.";
  const rows = suppliers
    .map((s) => ({ name: s.name.trim(), role: s.role.trim() }))
    .filter((s) => s.name);
  if (!rows.length) return "Add at least one supplier name.";
  const missingRole = rows.find((s) => !s.role);
  if (missingRole) {
    return "Every supplier needs a role (what they do—for example raw materials or packaging).";
  }
  return null;
}

function buildComplianceRequest(
  productDescription: string,
  suppliers: SupplierInput[],
): ReportRequest | null {
  if (complianceRequestError(productDescription, suppliers)) return null;
  const product = productDescription.trim();
  const sups = suppliers
    .map((s) => ({ name: s.name.trim(), role: s.role.trim() }))
    .filter((s) => s.name);
  return { product_description: product, suppliers: sups };
}

export function useSentinelState() {
  const [tab, setTabInner] = useState<SentinelTab>("compliance");

  const [complianceProduct, setComplianceProduct] = useState("");
  const [complianceSuppliers, setComplianceSuppliers] = useState<SupplierInput[]>([emptySupplier()]);
  const [complianceReport, setComplianceReport] = useState<ReportResponse | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [compliancePdfLoading, setCompliancePdfLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const setTab = useCallback(
    (t: SentinelTab) => {
      if (t === "supplychain" && !complianceReport) return;
      setTabInner(t);
    },
    [complianceReport],
  );

  useEffect(() => {
    if (!complianceReport && tab === "supplychain") {
      setTabInner("compliance");
    }
  }, [complianceReport, tab]);

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
    setComplianceError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data
          .map((row) => ({
            name: (row.name ?? row.supplier_name ?? row.Supplier ?? "").trim(),
            role: (row.role ?? row.supplier_role ?? row.Role ?? "").trim(),
          }))
          .filter((r) => r.name);
        if (!rows.length) return;
        const missingRole = rows.find((r) => !r.role);
        if (missingRole) {
          setComplianceError(
            "CSV must include a role for every supplier. Use a column named role, supplier_role, or Role.",
          );
          return;
        }
        setComplianceSuppliers(rows);
      },
    });
  }, []);

  const runComplianceReport = useCallback(async () => {
    setComplianceError(null);
    const reqErr = complianceRequestError(complianceProduct, complianceSuppliers);
    if (reqErr) {
      setComplianceError(reqErr);
      return;
    }
    const body = buildComplianceRequest(complianceProduct, complianceSuppliers);
    if (!body) {
      setComplianceError("Check product description and suppliers, then try again.");
      return;
    }
    setComplianceLoading(true);
    try {
      const r = await postReport(body);
      setComplianceReport(r);
    } catch (e) {
      setComplianceError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setComplianceLoading(false);
    }
  }, [complianceProduct, complianceSuppliers]);

  const downloadCompliancePdf = useCallback(async () => {
    setComplianceError(null);
    const reqErr = complianceRequestError(complianceProduct, complianceSuppliers);
    if (reqErr) {
      setComplianceError(reqErr);
      return;
    }
    const body = buildComplianceRequest(complianceProduct, complianceSuppliers);
    if (!body) {
      setComplianceError("Check product description and suppliers, then try again.");
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

  const mergeSupplyChain = useCallback((supply_chain: SupplyChainAnalysis) => {
    setComplianceReport((prev) => (prev ? { ...prev, supply_chain } : null));
  }, []);

  const clearComplianceReport = useCallback(() => {
    setComplianceReport(null);
    setComplianceError(null);
    setComplianceProduct("");
    setComplianceSuppliers([emptySupplier()]);
  }, []);

  return {
    tab,
    setTab,
    complianceProduct,
    setComplianceProduct,
    complianceSuppliers,
    addComplianceSupplierRow,
    updateComplianceSupplierRow,
    removeComplianceSupplierRow,
    onComplianceCsv,
    complianceReport,
    mergeSupplyChain,
    clearComplianceReport,
    complianceLoading,
    compliancePdfLoading,
    complianceError,
    runComplianceReport,
    downloadCompliancePdf,
  };
}
