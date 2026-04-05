"use client";

import { ComplianceTab } from "./tabs/ComplianceTab";
import { SupplyChainTab } from "./tabs/SupplyChainTab";
import { BrowserAgentTab } from "./tabs/BrowserAgentTab";
import { SentinelHeader } from "./SentinelHeader";
import { useSentinelState } from "./useSentinelState";

export function SentinelApp() {
  const s = useSentinelState();

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <SentinelHeader tab={s.tab} onTab={s.setTab} reportTabsUnlocked={s.complianceReport != null} />
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
        {s.tab === "supplychain" && s.complianceReport && (
          <SupplyChainTab
            productDescription={s.complianceReport.product_description}
            analysis={s.complianceReport.supply_chain ?? { stages: [] }}
            supplierRisk={s.complianceReport.supplier_risk}
            onSupplyChainUpdated={s.mergeSupplyChain}
            onTakeAction={s.prefillBrowserAgent}
          />
        )}
        {s.tab === "browser" && (
          <BrowserAgentTab
            initialCompany={s.browserPrefill?.company}
            initialNote={s.browserPrefill?.note}
          />
        )}
      </main>
    </div>
  );
}
