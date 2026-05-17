"use client";

import { useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer
} from 'recharts';

const MOCK_DATA = {
  totalBudget: 8000000,
  spent: 5330000,
  committed: 890000,
  available: 1780000,
  burnRate: 177667,
  historicalAvgBurnRate: 140000,
  historicalStdDev: 12000,
  projectedExhaustDate: '2026-06-24',
  daysRemaining: 38,
  periodEnd: '2026-06-30',
  byCategory: [
    { category: 'Antibiotics', budget: 2000000, spent: 1850000, committed: 100000, pct: 92.5 },
    { category: 'Surgical',    budget: 1500000, spent: 1100000, committed: 100000, pct: 80.0 },
    { category: 'Diagnostics', budget: 1200000, spent: 900000,  committed: 80000,  pct: 81.7 },
    { category: 'Vaccines',    budget: 1000000, spent: 660000,  committed: 100000, pct: 76.0 },
    { category: 'Equipment',   budget: 800000,  spent: 450000,  committed: 90000,  pct: 67.5 },
  ]
};

const formatPHP = (val: number, decimals = 1) => {
  if (val >= 1000000) return `₱${(val / 1000000).toFixed(decimals)}M`;
  return `₱${(val / 1000).toFixed(0)}k`;
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-2 border rounded shadow-lg text-[10px] font-mono"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
      >
        <p className="font-bold border-b pb-1 mb-1" style={{ borderColor: 'var(--border-subtle)' }}>{label}</p>
        {payload.map((p: any) => {
          if (p.value === null || p.value === undefined) return null;
          return (
            <div key={p.dataKey} className="flex justify-between items-center gap-4">
              <span style={{ color: p.color }}>{p.name === 'actual' ? 'Actual spent' : 'Projected spend'}</span>
              <span className="font-bold">₱{Number(p.value).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function ProcurementBurnRate() {
  const activeCategory = useDashboardStore(state => state.filters.category);
  const setFilter = useDashboardStore(state => state.setFilter);

  // Generate 30 days of spend projection data from Jun 1 to Jun 30
  const projectionData = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `Jun ${day}`;
      
      // Actual spend grows to 5,330,000 on June 20 (index 19)
      let actual = null;
      if (idx <= 19) {
        actual = Math.round((idx / 19) * 5330000);
      }
      
      // Projected spend: actual up to June 20, then grows by 177667 per day
      let projected = null;
      if (idx <= 19) {
        projected = actual;
      } else {
        projected = 5330000 + (idx - 19) * 177667;
      }
      
      return {
        date: dateStr,
        actual,
        projected,
        budget: 8000000
      };
    });
  }, []);

  return (
    <div className="flex flex-col h-full w-full justify-between pb-1 pt-1">
      {/* Top Header: Burn rate label and text stats */}
      <div className="flex items-center justify-between border-b pb-1.5 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-col">
          <span className="text-[14px] font-bold font-mono" style={{ color: 'var(--accent-amber)' }}>
            ⚡ Burning ₱{MOCK_DATA.burnRate.toLocaleString()}/day
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
            Exhaustion Rate
          </span>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-[12px] font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
            {formatPHP(MOCK_DATA.available, 2)}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
            Available Budget
          </span>
        </div>
      </div>

      {/* Projection Timeline LineChart */}
      <div className="h-[90px] w-full shrink-0 mt-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={projectionData} margin={{ top: 12, right: 10, left: -25, bottom: -10 }}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 7, fill: 'var(--text-secondary)' }} 
              tickLine={false} 
              axisLine={false} 
              interval={5} 
            />
            <YAxis 
              tick={{ fontSize: 7, fill: 'var(--text-secondary)' }} 
              tickFormatter={(val) => `₱${(val / 1000000).toFixed(0)}M`} 
              tickLine={false} 
              axisLine={false} 
              domain={[0, 8500000]} 
            />
            <Tooltip content={<CustomChartTooltip />} />
            
            {/* Reference Line for Today */}
            <ReferenceLine 
              x="Jun 20" 
              stroke="var(--text-secondary)" 
              strokeDasharray="2 2" 
              label={{ value: 'Today', fill: 'var(--text-secondary)', fontSize: 6, position: 'top' }} 
            />
            
            {/* Reference Line for Exhaustion Date */}
            <ReferenceLine 
              x="Jun 24" 
              stroke="var(--accent-red)" 
              strokeWidth={1.5} 
              label={{ value: '⚠ Exhausts Jun 24', fill: 'var(--accent-red)', fontSize: 7, position: 'insideTopLeft', fontWeight: 'bold' }} 
            />
            
            {/* Horizontal Line for Budget Ceiling */}
            <ReferenceLine 
              y={8000000} 
              stroke="var(--accent-green)" 
              strokeWidth={1} 
              strokeDasharray="3 1"
              label={{ value: 'Ceiling ₱8.0M', fill: 'var(--accent-green)', fontSize: 6, position: 'insideBottomRight' }} 
            />
            
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="var(--accent-teal)" 
              strokeWidth={1.5} 
              dot={false} 
              activeDot={{ r: 3 }} 
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="projected" 
              stroke="var(--accent-amber)" 
              strokeWidth={1.5} 
              strokeDasharray="3 3" 
              dot={false} 
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown (Scrollable) */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar min-h-0 mt-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {MOCK_DATA.byCategory.map(cat => {
          const isFaded = activeCategory && activeCategory !== cat.category;
          const spentPct = (cat.spent / cat.budget) * 100;
          const committedPct = (cat.committed / cat.budget) * 100;
          const totalPct = cat.pct; // provided in mock data
          
          let colorClass = 'var(--accent-green)';
          if (totalPct > 75) colorClass = 'var(--accent-amber)';
          if (totalPct > 90) colorClass = 'var(--accent-red)';

          return (
            <div 
              key={cat.category}
              onClick={() => setFilter('category', activeCategory === cat.category ? null : cat.category)}
              className="flex flex-col gap-0.5 cursor-pointer transition-opacity"
              style={{ opacity: isFaded ? 0.3 : 1 }}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{cat.category}</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{formatPHP(cat.budget)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden flex">
                  {/* Spent Bar */}
                  <div 
                    className="h-full bg-[var(--accent-teal)]"
                    style={{ width: `${spentPct}%` }}
                  />
                  {/* Committed Bar */}
                  <div 
                    className="h-full bg-[var(--accent-amber)]"
                    style={{ width: `${committedPct}%` }}
                  />
                </div>
                <span className="text-[9px] w-8 text-right font-mono font-bold" style={{ color: colorClass }}>
                  {totalPct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
