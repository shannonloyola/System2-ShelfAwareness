"use client";

import { useState } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const MOCK_SUPPLIERS = [
  { id: 'SUP-001', name: 'MedLine Philippines', deliverySpeed: 88, fillRate: 94, qcPassRate: 97, onTimeRate: 91, leadTimeScore: 78, responseScore: 85, overallScore: 88.8, color: '#00A3AD' },
  { id: 'SUP-002', name: 'PharmaDist Inc', deliverySpeed: 75, fillRate: 88, qcPassRate: 92, onTimeRate: 80, leadTimeScore: 65, responseScore: 90, overallScore: 81.6, color: '#3B82F6' },
  { id: 'SUP-003', name: 'GlobalMed Supply', deliverySpeed: 95, fillRate: 98, qcPassRate: 99, onTimeRate: 96, leadTimeScore: 88, responseScore: 92, overallScore: 94.6, color: '#10B981' },
  { id: 'SUP-004', name: 'BioTech Imports', deliverySpeed: 60, fillRate: 75, qcPassRate: 85, onTimeRate: 65, leadTimeScore: 50, responseScore: 70, overallScore: 67.5, color: '#EF4444' },
  { id: 'SUP-005', name: 'CarePlus Logic', deliverySpeed: 82, fillRate: 85, qcPassRate: 90, onTimeRate: 85, leadTimeScore: 80, responseScore: 75, overallScore: 82.8, color: '#F59E0B' },
].sort((a, b) => b.overallScore - a.overallScore); // Pre-sort for leaderboard

const RADAR_METRICS = [
  'Delivery Speed',
  'Fill Rate',
  'QC Pass Rate',
  'On-Time Rate',
  'Lead Time',
  'Response',
] as const;

const RADAR_DATA = RADAR_METRICS.map(metric => {
  const row: any = { metric };
  MOCK_SUPPLIERS.forEach(s => {
    let val = 0;
    if (metric === 'Delivery Speed') val = s.deliverySpeed;
    if (metric === 'Fill Rate') val = s.fillRate;
    if (metric === 'QC Pass Rate') val = s.qcPassRate;
    if (metric === 'On-Time Rate') val = s.onTimeRate;
    if (metric === 'Lead Time') val = s.leadTimeScore;
    if (metric === 'Response') val = s.responseScore;
    row[s.name] = val;
  });
  return row;
});

const getScoreColor = (score: number) => {
  if (score > 85) return 'var(--accent-green)';
  if (score >= 70) return 'var(--accent-amber)';
  return 'var(--accent-red)';
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 border rounded shadow-lg min-w-[150px]" style={{ backgroundColor: '#1A3A5C', borderColor: 'var(--border-subtle)' }}>
        <p className="text-[12px] font-bold text-white mb-2">{payload[0].payload.metric}</p>
        <div className="flex flex-col gap-1 text-[10px] font-mono">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex justify-between items-center gap-4">
              <span style={{ color: entry.color }}>{entry.name}</span>
              <span className="font-bold text-white">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function SupplierReliabilityScorecard() {
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeSupplier = useDashboardStore(state => state.filters.supplier);
  const [hoveredSupplier, setHoveredSupplier] = useState<string | null>(null);

  const activeFocus = activeSupplier || hoveredSupplier;

  return (
    <div className="flex h-full w-full gap-4 pt-2 relative">
      {/* Left: Radar Chart (60%) */}
      <div className="w-[60%] flex flex-col h-full shrink-0">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="60%" data={RADAR_DATA}>
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis 
                dataKey="metric" 
                tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'var(--font-label)' }} 
              />
              <Tooltip content={<CustomTooltip />} />
              
              {MOCK_SUPPLIERS.map(s => {
                const isFaded = activeFocus && activeFocus !== s.name;
                return (
                  <Radar
                    key={s.id}
                    name={s.name}
                    dataKey={s.name}
                    stroke={s.color}
                    fill={s.color}
                    fillOpacity={isFaded ? 0.05 : 0.15}
                    strokeOpacity={isFaded ? 0.2 : 1}
                    strokeWidth={isFaded ? 1 : 2}
                    activeDot={{ r: 4 }}
                    style={{ transition: 'all 300ms ease' }}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Radar Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 mb-2 pb-[12px]">
          {MOCK_SUPPLIERS.map(s => {
            const isFaded = activeFocus && activeFocus !== s.name;
            return (
              <div 
                key={s.id} 
                className="flex items-center gap-1.5 cursor-pointer transition-opacity text-[9px] font-mono"
                style={{ opacity: isFaded ? 0.3 : 1 }}
                onClick={() => setFilter('supplier', activeSupplier === s.name ? null : s.name)}
                onMouseEnter={() => setHoveredSupplier(s.name)}
                onMouseLeave={() => setHoveredSupplier(null)}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="truncate max-w-[80px]" style={{ color: 'var(--text-primary)' }} title={s.name}>{s.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Leaderboard (40%) */}
      <div className="w-[40%] flex flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {MOCK_SUPPLIERS.map((s, idx) => {
          const isFaded = activeFocus && activeFocus !== s.name;
          const scoreColor = getScoreColor(s.overallScore);
          
          return (
            <div 
              key={s.id}
              onClick={() => setFilter('supplier', activeSupplier === s.name ? null : s.name)}
              onMouseEnter={() => setHoveredSupplier(s.name)}
              onMouseLeave={() => setHoveredSupplier(null)}
              className="flex flex-col p-2 rounded border border-transparent cursor-pointer transition-all hover:opacity-85 relative"
              style={{ 
                opacity: isFaded ? 0.3 : 1,
                borderColor: activeSupplier === s.name ? s.color : 'var(--border-subtle)',
                backgroundColor: activeSupplier === s.name ? `${s.color}15` : 'var(--bg-elevated)'
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black" style={{ backgroundColor: 'var(--text-secondary)' }}>
                    {idx + 1}
                  </div>
                  <span className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }} title={s.name}>
                    {s.name}
                  </span>
                  {idx === 0 && <span title="Best Performer" className="text-[12px]">👑</span>}
                  {s.overallScore < 75 && <span title="At Risk Supplier" className="text-[12px]">🚨</span>}
                </div>
                <span className="text-[11px] font-mono font-bold" style={{ color: scoreColor }}>
                  {s.overallScore.toFixed(1)}
                </span>
              </div>
              
              <div className="w-full h-1 bg-[var(--bg-base)] rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${s.overallScore}%`, backgroundColor: scoreColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
