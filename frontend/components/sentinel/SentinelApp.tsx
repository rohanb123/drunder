"use client";

import { ComplianceTab } from "./tabs/ComplianceTab";
import { WhatIfTab } from "./tabs/WhatIfTab";
import { SentinelHeader } from "./SentinelHeader";
import { useSentinelState } from "./useSentinelState";

export function SentinelApp() {
  const s = useSentinelState();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <SentinelHeader
        tab={s.tab}
        onTab={s.setTab}
        onUnifiedPdf={() => void s.requestUnifiedPdfFromHeader()}
        unifiedPdfBusy={s.compliancePdfLoading}
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {s.tab === "compliance" && (
          <ComplianceTab
            productDescription={s.complianceProduct}
            setProductDescription={s.setComplianceProduct}
            suppliers={s.complianceSuppliers}
            addSupplierRow={s.addComplianceSupplierRow}
            updateSupplierRow={s.updateComplianceSupplierRow}
            removeSupplierRow={s.removeComplianceSupplierRow}
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
        {s.tab === "whatif" && (
          <WhatIfTab
            baselineSuppliers={s.whatIfSuppliers}
            addBaselineRow={s.addWhatIfSupplierRow}
            updateBaselineRow={s.updateWhatIfSupplierRow}
            removeBaselineRow={s.removeWhatIfSupplierRow}
            event={s.event}
            setEvent={s.setEvent}
            streaming={s.streaming}
            runWhatIf={() => void s.runWhatIf()}
            narrative={s.narrative}
            result={s.result}
            streamErr={s.streamErr}
            parseErr={s.parseErr}
          />
        )}
      </main>
    </div>
  );
}
