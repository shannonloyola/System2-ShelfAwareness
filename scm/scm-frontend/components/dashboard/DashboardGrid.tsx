"use client";

import { useState, useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import PanelWrapper from "./PanelWrapper";
import InventoryValuationTrend from "./executive/InventoryValuationTrend";
import CriticalStockRiskMatrix from "./executive/CriticalStockRiskMatrix";
import BudgetWaterfall from "./executive/BudgetWaterfall";
import TopExposureProducts from "./executive/TopExposureProducts";
import LiveStockMovementFeed from "./operations/LiveStockMovementFeed";
import BackorderAgingHistogram from "./operations/BackorderAgingHistogram";
import SupplierReliabilityScorecard from "./procurement/SupplierReliabilityScorecard";
import POLeadTimeDistribution from "./procurement/POLeadTimeDistribution";
import ProcurementBurnRate from "./procurement/ProcurementBurnRate";
import DashboardActionCenter from "./DashboardActionCenter";

function SectionLabel({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1 pt-1">
      <div className="space-y-1">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--accent-teal)", fontFamily: "var(--font-label)" }}
        >
          {eyebrow}
        </div>
        {title && (
          <div className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardGrid() {
  const { activeRole, dateRange, filters } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [fadeState, setFadeState] = useState<'in' | 'out'>('in');
  const [displayedRole, setDisplayedRole] = useState(activeRole);

  useEffect(() => {
    if (activeRole !== displayedRole) {
      setFadeState('out');
      const timer1 = setTimeout(() => {
        setDisplayedRole(activeRole);
        setIsLoading(true);
        setFadeState('in');
        
        const timer2 = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(timer2);
      }, 150);
      return () => clearTimeout(timer1);
    } else {
      setIsLoading(true);
      const t = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(t);
    }
  }, [dateRange, activeRole, displayedRole]);

  // Determine if filters are active for each view
  const hasFilter = Object.values(filters).some(v => v !== null);

  // Determine applicable filters for components
  const f = filters;
  const execFilters = f.category !== null; // Executive usually filters by category
  const opsFilters = f.zone !== null || f.sku !== null || f.status !== null;
  const procFilters = f.supplier !== null || f.category !== null || f.sku !== null;

  const fadeStyle = {
    opacity: fadeState === 'in' ? 1 : 0,
    transition: `opacity ${fadeState === 'out' ? '150ms' : '200ms'} ease-in-out`
  };

  if (displayedRole === 'Executive') {
    return (
      <div className="flex flex-col w-full h-full pb-8" style={{ ...fadeStyle, padding: '16px', gap: '12px' }}>
        <SectionLabel
          eyebrow="Risk & Trend Diagnostics"
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Inventory Valuation Trend" className="md:col-span-3" style={{ height: '340px', flexShrink: 0 }} chartType="line">
            <InventoryValuationTrend />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Critical Stock Products" className="md:col-span-2" style={{ height: '340px', flexShrink: 0 }} chartType="table" contentOverflow="hidden">
            <CriticalStockRiskMatrix />
          </PanelWrapper>
        </div>
        <SectionLabel
          eyebrow="Strategic Action Center"
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={hasFilter} title="Executive Action Center" className="md:col-span-3" style={{ minHeight: '250px', flexShrink: 0 }} chartType="table">
            <DashboardActionCenter role="Executive" />
          </PanelWrapper>
          <div className="md:col-span-2 flex flex-col gap-[12px]">
            <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Budget Position" style={{ height: '140px', flexShrink: 0 }} chartType="bar" contentOverflow="hidden">
              <BudgetWaterfall />
            </PanelWrapper>
            <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Top Exposure Products" style={{ height: '210px', flexShrink: 0 }} chartType="bar" contentOverflow="hidden">
              <TopExposureProducts />
            </PanelWrapper>
          </div>
        </div>
      </div>
    );
  }

  if (displayedRole === 'Operations') {
    return (
      <div className="flex flex-col w-full h-full pb-8" style={{ ...fadeStyle, padding: '16px', gap: '12px' }}>
        <SectionLabel
          eyebrow="Operational monitoring"
        />
        <div className="grid flex-1 min-h-[640px] grid-cols-1 md:grid-cols-12 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="STOCK MOVEMENT FEED" className="md:col-span-7" style={{ minHeight: '430px', height: '100%', flexShrink: 0 }} chartType="table" contentOverflow="hidden">
            <LiveStockMovementFeed />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Backorder Aging Histogram" className="md:col-span-5" style={{ minHeight: '430px', height: '100%', flexShrink: 0 }} chartType="bar" contentOverflow="hidden">
            <BackorderAgingHistogram />
          </PanelWrapper>
        </div>
        <SectionLabel
          eyebrow="Operations Action Center"
        />
        <PanelWrapper isLoading={isLoading} filterActive={hasFilter} title="Operations Action Center" style={{ minHeight: '320px', flexShrink: 0 }} chartType="table">
          <DashboardActionCenter role="Operations" />
        </PanelWrapper>
      </div>
    );
  }

  if (displayedRole === 'Procurement') {
    return (
      <div className="flex flex-col w-full h-full pb-8" style={{ ...fadeStyle, padding: '16px', gap: '12px' }}>
        <SectionLabel
          eyebrow="Predictive sourcing risk"
        />
        <div className="grid flex-1 min-h-[560px] grid-cols-1 md:grid-cols-12 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Supplier Reliability Scorecard" className="md:col-span-7" style={{ minHeight: '360px', height: '100%', flexGrow: 1 }} chartType="mixed">
            <SupplierReliabilityScorecard />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="PO Lead Time Distribution" className="md:col-span-5" style={{ minHeight: '360px', height: '100%', flexGrow: 1 }} chartType="bar">
            <POLeadTimeDistribution />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Procurement Budget Utilization" className="md:col-span-12" style={{ minHeight: '180px', flexGrow: 1 }} chartType="bar">
            <ProcurementBurnRate />
          </PanelWrapper>
        </div>
        <SectionLabel
          eyebrow="Prescriptive action center"
        />
        <PanelWrapper isLoading={isLoading} filterActive={hasFilter} title="Procurement Action Center" style={{ minHeight: '320px', flexShrink: 0 }} chartType="table">
          <DashboardActionCenter role="Procurement" />
        </PanelWrapper>
      </div>
    );
  }

  return null;
}
