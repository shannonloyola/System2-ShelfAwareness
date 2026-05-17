"use client";

import { useState, useEffect } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import PanelWrapper from "./PanelWrapper";
import InventoryValuationTrend from "./executive/InventoryValuationTrend";
import CriticalStockRiskMatrix from "./executive/CriticalStockRiskMatrix";
import SupplyChainHealthScore from "./executive/SupplyChainHealthScore";
import BudgetWaterfall from "./executive/BudgetWaterfall";
import TopExposureProducts from "./executive/TopExposureProducts";
import LiveStockMovementFeed from "./operations/LiveStockMovementFeed";
import WarehouseZoneHeatmap from "./operations/WarehouseZoneHeatmap";
import CycleCountAccuracyTrend from "./operations/CycleCountAccuracyTrend";
import BackorderAgingHistogram from "./operations/BackorderAgingHistogram";
import TransferVelocityFunnel from "./operations/TransferVelocityFunnel";
import SupplierReliabilityScorecard from "./procurement/SupplierReliabilityScorecard";
import POLeadTimeDistribution from "./procurement/POLeadTimeDistribution";
import ProcurementBurnRate from "./procurement/ProcurementBurnRate";
import BackorderRootCausePareto from "./procurement/BackorderRootCausePareto";
import InboundGRNPipeline from "./procurement/InboundGRNPipeline";

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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Inventory Valuation Trend" className="md:col-span-3" style={{ height: '350px', flexShrink: 0 }} chartType="line">
            <InventoryValuationTrend />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Critical Stock Risk Matrix" className="md:col-span-2" style={{ height: '350px', flexShrink: 0 }} chartType="mixed">
            <CriticalStockRiskMatrix />
          </PanelWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Supply Chain Health Score" style={{ height: '260px', flexShrink: 0 }} chartType="gauge">
            <SupplyChainHealthScore />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Budget Allocation vs. Spend" style={{ height: '260px', flexShrink: 0 }} chartType="bar">
            <BudgetWaterfall />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={execFilters} title="Top 10 Exposure Products" style={{ height: '260px', flexShrink: 0 }} chartType="bar">
            <TopExposureProducts />
          </PanelWrapper>
        </div>
      </div>
    );
  }

  if (displayedRole === 'Operations') {
    return (
      <div className="flex flex-col w-full h-full pb-8" style={{ ...fadeStyle, padding: '16px', gap: '12px' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Live Stock Movement Feed" className="md:col-span-2" style={{ height: '350px', flexShrink: 0 }} chartType="table">
            <LiveStockMovementFeed />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Warehouse Zone Heatmap" className="md:col-span-3" style={{ height: '350px', flexShrink: 0 }} chartType="mixed">
            <WarehouseZoneHeatmap />
          </PanelWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Cycle Count Accuracy Trend" style={{ height: '260px', flexShrink: 0 }} chartType="line">
            <CycleCountAccuracyTrend />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Backorder Aging Histogram" style={{ height: '260px', flexShrink: 0 }} chartType="bar">
            <BackorderAgingHistogram />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={opsFilters} title="Transfer Velocity Funnel" style={{ height: '260px', flexShrink: 0 }} chartType="bar">
            <TransferVelocityFunnel />
          </PanelWrapper>
        </div>
      </div>
    );
  }

  if (displayedRole === 'Procurement') {
    return (
      <div className="flex flex-col w-full h-full pb-8" style={{ ...fadeStyle, padding: '16px', gap: '12px' }}>
        <div className="grid grid-cols-1 md:grid-cols-10 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Backorder Root Cause Pareto" className="md:col-span-5" style={{ height: '350px', flexShrink: 0 }} chartType="mixed">
            <BackorderRootCausePareto />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="PO Lead Time Distribution" className="md:col-span-5" style={{ height: '350px', flexShrink: 0 }} chartType="bar">
            <POLeadTimeDistribution />
          </PanelWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-10 gap-[12px]">
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Procurement Budget Burn Rate" className="md:col-span-3" style={{ height: '260px', flexShrink: 0 }} chartType="gauge">
            <ProcurementBurnRate />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Supplier Reliability Scorecard" className="md:col-span-4" style={{ height: '260px', flexShrink: 0 }} chartType="line">
            <SupplierReliabilityScorecard />
          </PanelWrapper>
          <PanelWrapper isLoading={isLoading} filterActive={procFilters} title="Inbound GRN Status Pipeline" className="md:col-span-3" style={{ height: '260px', flexShrink: 0 }} chartType="kanban">
            <InboundGRNPipeline />
          </PanelWrapper>
        </div>
      </div>
    );
  }

  return null;
}
