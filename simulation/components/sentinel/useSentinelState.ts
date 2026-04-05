"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { postReport, postReportPdf } from "@/lib/clearpath/api";
import type { ReportRequest, ReportResponse, SupplierInput } from "@/lib/clearpath/types";
import type { SimulationResult, StackedScenario } from "@/lib/simulation-types";
import { streamSimulation } from "@/lib/simulation";
import { useAction, useMutation, useQuery } from "convex/react";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import { countryShares, highRiskSupplierCount, toProfileContext } from "./profile-utils";
import type { SentinelTab } from "./SentinelHeader";

const PALETTE = ["#7c3aed", "#0ea5e9", "#f97316"];

const emptySupplier = (): SupplierInput => ({ name: "" });

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
  const profiles = useQuery(api.profiles.listProfiles);
  const createProfile = useMutation(api.profiles.createProfile);
  const addSupplier = useMutation(api.profiles.addSupplier);
  const runSimulationSync = useAction(api.simulate.run);

  const [tab, setTab] = useState<SentinelTab>("whatif");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [event, setEvent] = useState("");
  const [scenarioLabel, setScenarioLabel] = useState("");
  const [narrative, setNarrative] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [stacked, setStacked] = useState<StackedScenario[]>([]);
  const [useStream, setUseStream] = useState(true);

  const [complianceProduct, setComplianceProduct] = useState("");
  const [complianceSuppliers, setComplianceSuppliers] = useState<SupplierInput[]>([emptySupplier()]);
  const [complianceReport, setComplianceReport] = useState<ReportResponse | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [compliancePdfLoading, setCompliancePdfLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);

  const profileDetail = useQuery(
    api.profiles.getProfileDetail,
    selectedId ? { profileId: selectedId as Id<"supplyChainProfiles"> } : "skip",
  );

  useEffect(() => {
    if (!profiles) return;
    if (!selectedId && profiles.length > 0) setSelectedId(profiles[0]._id);
  }, [profiles, selectedId]);

  const ctx = useMemo(() => (profileDetail ? toProfileContext(profileDetail) : null), [profileDetail]);
  const highRiskCount = profileDetail ? highRiskSupplierCount(profileDetail.suppliers) : 0;
  const exposureRows = profileDetail ? countryShares(profileDetail.suppliers) : [];

  const runWhatIf = useCallback(async () => {
    if (!ctx || !event.trim()) return;
    setStreaming(true);
    setStreamErr(null);
    setParseErr(null);
    setResult(null);
    setNarrative("");
    try {
      if (useStream) {
        const out = await streamSimulation(event.trim(), ctx, (buf) => {
          const idx = buf.indexOf("<<<SIM_JSON>>>");
          setNarrative(idx === -1 ? buf : buf.slice(0, idx).trimEnd());
        });
        setNarrative(out.narrative);
        if (out.streamError) setStreamErr(out.streamError);
        if (out.parseError) setParseErr(out.parseError);
        if (out.result) setResult(out.result);
      } else {
        const out = await runSimulationSync({
          profileId: selectedId as Id<"supplyChainProfiles">,
          event: event.trim(),
        });
        const r = out as SimulationResult;
        setResult(r);
        setNarrative(r.summary);
      }
    } catch (e) {
      setStreamErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setStreaming(false);
    }
  }, [ctx, event, useStream, runSimulationSync, selectedId]);

  const pinScenario = useCallback(() => {
    if (!result || stacked.length >= 3) return;
    const label =
      scenarioLabel.trim() ||
      (event.trim().slice(0, 40) + (event.trim().length > 40 ? "…" : "")) ||
      `Scenario ${stacked.length + 1}`;
    setStacked((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        label,
        event: event.trim(),
        marginImpactPercent: result.marginImpactPercent,
        riskLevel: result.riskLevel,
        color: PALETTE[s.length % PALETTE.length],
      },
    ]);
    setScenarioLabel("");
  }, [result, stacked.length, event, scenarioLabel]);

  const onCsv = useCallback(
    async (file: File | null) => {
      if (!file || !selectedId) return;
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const start = lines[0]?.toLowerCase().includes("country") ? 1 : 0;
      const pid = selectedId as Id<"supplyChainProfiles">;
      for (let i = start; i < lines.length; i++) {
        const parts = lines[i].split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
        const [name, country] = parts;
        if (name && country) await addSupplier({ profileId: pid, name, country });
      }
    },
    [selectedId, addSupplier],
  );

  const addComplianceSupplierRow = useCallback(() => {
    setComplianceSuppliers((rows) => [...rows, emptySupplier()]);
  }, []);

  const updateComplianceSupplierRow = useCallback((index: number, patch: Partial<SupplierInput>) => {
    setComplianceSuppliers((rows) => rows.map((r, j) => (j === index ? { ...r, ...patch } : r)));
  }, []);

  const removeComplianceSupplierRow = useCallback((index: number) => {
    setComplianceSuppliers((rows) => (rows.length <= 1 ? rows : rows.filter((_, j) => j !== index)));
  }, []);

  const loadComplianceFromProfile = useCallback(() => {
    if (!profileDetail?.suppliers.length) return;
    const rows = profileDetail.suppliers.map((s) => ({ name: s.name.trim() })).filter((s) => s.name);
    setComplianceSuppliers(rows.length ? rows : [emptySupplier()]);
  }, [profileDetail]);

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

  const requestUnifiedPdfFromHeader = useCallback(() => {
    setTab("compliance");
    void downloadCompliancePdf();
  }, [downloadCompliancePdf]);

  const clearComplianceReport = useCallback(() => {
    setComplianceReport(null);
    setComplianceError(null);
  }, []);

  return {
    loading: profiles === undefined,
    profiles: profiles ?? [],
    profileDetail,
    selectedId,
    setSelectedId,
    newProfileName,
    setNewProfileName,
    tab,
    setTab,
    createProfile,
    onCsv,
    ctx,
    exposureRows,
    highRiskCount,
    event,
    setEvent,
    scenarioLabel,
    setScenarioLabel,
    useStream,
    setUseStream,
    narrative,
    streaming,
    result,
    streamErr,
    parseErr,
    stacked,
    runWhatIf,
    pinScenario,
    clearStack: () => setStacked([]),
    complianceProduct,
    setComplianceProduct,
    complianceSuppliers,
    addComplianceSupplierRow,
    updateComplianceSupplierRow,
    removeComplianceSupplierRow,
    loadComplianceFromProfile,
    canLoadFromProfile: Boolean(profileDetail?.suppliers.length),
    onComplianceCsv,
    complianceReport,
    clearComplianceReport,
    complianceLoading,
    compliancePdfLoading,
    complianceError,
    runComplianceReport,
    downloadCompliancePdf,
    requestUnifiedPdfFromHeader,
  };
}
