"use client";

import { useDashboardStore } from '@/store/dashboardStore';
import { ArrowUpRight, ArrowDownRight, Minus, X } from 'lucide-react';

interface KPIData {
  label: string;
  value: string;
  delta: number;
  inverseGood?: boolean;
  subLabel?: React.ReactNode;
}

export default function KPIScorecardBar() {
  const { activeRole, filters, clearFilters, setFilter } = useDashboardStore();

  const getKPIs = (): KPIData[] => {
    switch (activeRole) {
      case 'Executive':
        return [
          { label: 'Total Inventory Value', value: '₱14,230,000', delta: 4.2 },
          { 
            label: 'Fill Rate %', 
            value: '98.4%', 
            delta: 0.5,
            subLabel: <span className="text-[10px] block leading-none mt-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>of 1,240 order lines</span>
          },
          { label: 'Budget Utilization', value: '82.1%', delta: -2.3 },
          { 
            label: 'Critical SKUs Count', 
            value: '14', 
            delta: 2, 
            inverseGood: true,
            subLabel: <span className="text-[10px] block leading-none mt-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>of 847 active SKUs</span>
          },
          { label: 'Supply Chain Score', value: 'A-', delta: 0 },
        ];
      case 'Operations':
        return [
          { label: 'Pending Transfers', value: '42', delta: -5, inverseGood: true },
          { label: 'Backorder Count', value: '89', delta: 12, inverseGood: true },
          { 
            label: 'Cycle Count Accuracy', 
            value: '99.1%', 
            delta: 0.2,
            subLabel: <span className="text-[9.5px] block font-bold leading-none mt-1" style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-label)' }}>Stable — no action required</span>
          },
          { label: 'Pending Approvals', value: '7', delta: -1, inverseGood: true },
          { label: 'Avg Fulfillment (Days)', value: '1.2', delta: -0.1, inverseGood: true },
        ];
      case 'Procurement':
        return [
          { label: 'Open POs', value: '156', delta: 8 },
          { label: 'Avg Lead Time (Days)', value: '14.5', delta: 1.2, inverseGood: true },
          { label: 'Budget Remaining', value: '₱2,450,000', delta: -15, inverseGood: true },
          { label: 'Supplier On-Time %', value: '94.2%', delta: 1.1 },
          { label: 'GRNs Pending', value: '23', delta: -4, inverseGood: true },
        ];
    }
  };

  const kpis = getKPIs();
  const activeFilterKeys = Object.entries(filters).filter(([_, val]) => val !== null);

  return (
    <div id="kpi-scorecard-bar" className="flex flex-col w-full border-b" style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
      {/* Scorecards */}
      <div className="flex w-full overflow-x-auto custom-scrollbar" style={{ padding: '12px 20px', gap: '16px' }}>
        {kpis.map((kpi, idx) => {
          let deltaColor = 'var(--text-secondary)';
          let DeltaIcon = Minus;

          if (kpi.delta > 0) {
            deltaColor = kpi.inverseGood ? 'var(--accent-red)' : 'var(--accent-green)';
            DeltaIcon = ArrowUpRight;
          } else if (kpi.delta < 0) {
            deltaColor = kpi.inverseGood ? 'var(--accent-green)' : 'var(--accent-red)';
            DeltaIcon = ArrowDownRight;
          }

          return (
            <div 
              key={idx} 
              className="flex-1 flex items-center justify-between border rounded-xl shadow-sm transition-transform hover:scale-[1.01]"
              style={{ 
                backgroundColor: 'var(--bg-surface)', 
                borderColor: 'var(--border-subtle)', 
                padding: '8px 16px', 
                height: '84px', 
                flexShrink: 0,
                minWidth: '220px' 
              }}
            >
              <div className="flex flex-col justify-between h-full py-0.5">
                <span className="text-[9.5px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
                  {kpi.label}
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontSize: '21px', fontFamily: 'var(--font-data)', lineHeight: '1' }}>
                    {kpi.value}
                  </span>
                  {kpi.delta !== 0 && (
                    <div className="flex items-center font-bold text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)]" style={{ color: deltaColor }}>
                      <DeltaIcon className="w-2.5 h-2.5 mr-0.5 shrink-0" />
                      <span>{Math.abs(kpi.delta)}%</span>
                    </div>
                  )}
                </div>
                {kpi.subLabel}
              </div>
              
              {/* Micro Sparkline Placeholder (Teal) */}
              <div className="flex items-center justify-end opacity-70" style={{ width: '56px', height: '28px', flexShrink: 0 }}>
                <svg width="56" height="28" viewBox="0 0 56 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 24 L12 18 L24 26 L36 12 L48 16 L56 4" stroke="var(--accent-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Chips Bar */}
      {activeFilterKeys.length > 0 && (
        <div 
          className="flex items-center overflow-hidden transition-all duration-300"
          style={{ 
            padding: '6px 20px', 
            gap: '8px',
            height: 'auto'
          }}
        >
          <span className="text-[11px] uppercase tracking-wide font-medium mr-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
            Active Filters:
          </span>
          {activeFilterKeys.map(([key, value]) => (
            <div 
              key={key} 
              className="flex items-center gap-1.5 border px-3 text-[10px] rounded-full transition-colors"
              style={{ 
                height: '24px',
                backgroundColor: 'rgba(0, 163, 173, 0.2)', 
                borderColor: '#00A3AD', 
                color: '#00A3AD', 
                fontFamily: 'var(--font-label)' 
              }}
            >
              <span className="capitalize opacity-80">{key}:</span>
              <span className="font-bold">{value}</span>
              <button onClick={() => setFilter(key as any, null)} className="ml-1 hover:opacity-70 transition-opacity p-0.5 rounded-full hover:bg-black/10">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <button 
            onClick={clearFilters}
            className="flex items-center border rounded-full px-3 text-[10px] font-bold transition-all hover:opacity-80"
            style={{ height: '24px', borderColor: '#EF4444', color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
