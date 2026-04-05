"use client";

import { SentinelHeader } from "./SentinelHeader";
import { ComplianceTab } from "./tabs/ComplianceTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { RadarTab } from "./tabs/RadarTab";
import { WhatIfTab } from "./tabs/WhatIfTab";
import { useSentinelState } from "./useSentinelState";

export function SentinelApp() {
  const s = useSentinelState();

  if (s.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <SentinelHeader
        supplierCount={s.profileDetail?.suppliers.length ?? 0}
        highRiskCount={s.highRiskCount}
        tab={s.tab}
        onTab={s.setTab}
        onUnifiedPdf={() => void s.requestUnifiedPdfFromHeader()}
        unifiedPdfBusy={s.compliancePdfLoading}
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {s.tab === "profile" && (
          <ProfileTab
            profiles={s.profiles}
            profileDetail={s.profileDetail}
            selectedId={s.selectedId}
            setSelectedId={s.setSelectedId}
            newProfileName={s.newProfileName}
            setNewProfileName={s.setNewProfileName}
            createProfile={s.createProfile}
            onCsv={s.onCsv}
            exposureRows={s.exposureRows}
          />
        )}
        {s.tab === "whatif" && (
          <WhatIfTab
            profilesLength={s.profiles.length}
            selectedId={s.selectedId}
            ctx={s.ctx}
            event={s.event}
            setEvent={s.setEvent}
            useStream={s.useStream}
            setUseStream={s.setUseStream}
            streaming={s.streaming}
            runWhatIf={() => void s.runWhatIf()}
            narrative={s.narrative}
            result={s.result}
            streamErr={s.streamErr}
            parseErr={s.parseErr}
            scenarioLabel={s.scenarioLabel}
            setScenarioLabel={s.setScenarioLabel}
            stacked={s.stacked}
            pinScenario={s.pinScenario}
            clearStack={s.clearStack}
          />
        )}
        {s.tab === "radar" && <RadarTab stacked={s.stacked} result={s.result} />}
        {s.tab === "compliance" && (
          <ComplianceTab
            productDescription={s.complianceProduct}
            setProductDescription={s.setComplianceProduct}
            suppliers={s.complianceSuppliers}
            addSupplierRow={s.addComplianceSupplierRow}
            updateSupplierRow={s.updateComplianceSupplierRow}
            removeSupplierRow={s.removeComplianceSupplierRow}
            loadSuppliersFromProfile={s.loadComplianceFromProfile}
            canLoadFromProfile={s.canLoadFromProfile}
            onComplianceCsv={s.onComplianceCsv}
            report={s.complianceReport}
            clearReport={s.clearComplianceReport}
            complianceLoading={s.complianceLoading}
            compliancePdfLoading={s.compliancePdfLoading}
            complianceError={s.complianceError}
            onGenerateReport={() => void s.runComplianceReport()}
            onDownloadPdf={() => void s.downloadCompliancePdf()}
          />
        )}
      </main>
    </div>
  );
}
