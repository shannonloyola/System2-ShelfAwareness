"use client";

import { useMemo, useState, useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { EmptyDashboardState, useDashboardData } from '../DashboardDataContext';

interface BinData {
  zone: string;
  aisle: string;
  bin: string;
  capacity: number;
  currentStock: number;
  utilizationPct: number;
  topProduct: string;
  skuCount: number;
  hasAlert: boolean;
}

const getColor = (util: number) => {
  if (util <= 30) return 'var(--bg-elevated)';
  if (util <= 60) return 'rgba(0,163,173,0.4)';
  if (util <= 85) return 'rgba(0,163,173,0.9)';
  if (util < 100) return '#f59e0b';
  return '#ef4444';
};

const TooltipContent = ({ data }: { data: BinData | null }) => {
  if (!data) return null;
  return (
    <div 
      className="flex flex-col gap-1 z-50 p-2 border rounded shadow-lg pointer-events-none" 
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--accent-teal)' }}
    >
      <p className="text-[11px] font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{data.zone} - {data.aisle} - {data.bin}</p>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="flex flex-col text-[10px]">
          <span style={{ color: 'var(--text-secondary)' }}>Utilization</span>
          <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{data.utilizationPct}%</span>
        </div>
        <div className="flex flex-col text-[10px]">
          <span style={{ color: 'var(--text-secondary)' }}>SKUs</span>
          <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{data.skuCount}</span>
        </div>
      </div>
      <div className="flex flex-col text-[10px] mt-1 border-t pt-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Top Product</span>
        <span className="font-bold truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>{data.topProduct}</span>
      </div>
    </div>
  );
};

export default function WarehouseZoneHeatmap() {
  const [mounted, setMounted] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{ x: number, y: number, data: BinData } | null>(null);
  const { data: dashboardData, isLoading } = useDashboardData();
  
  // Dashboard cross-filtering state
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeZoneFilter = useDashboardStore(state => state.filters.zone);

  const data = useMemo(() => dashboardData?.operations?.warehouseZoneHeatmap || [], [dashboardData]);
  const zones = useMemo(() => Array.from(new Set(data.map((item) => item.zone))).slice(0, 4), [data]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const zoneStats = useMemo(() => {
    return zones.map(z => {
      const zData = data.filter(d => d.zone === z);
      const avg = Math.round(zData.reduce((acc, d) => acc + d.utilizationPct, 0) / zData.length) || 0;
      const alerts = zData.filter(d => d.hasAlert).length;
      return { zone: z, avg, alerts, data: zData };
    });
  }, [data, zones]);

  if (!data.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend warehouse data..." : "No warehouse location data returned by product/inventory services."} />;
  }

  return (
    <div className="flex flex-col h-full w-full relative justify-between pb-1">
      {/* 2x2 Grid of Zones */}
      <div className="flex-1 grid grid-cols-2 gap-x-5 gap-y-3 overflow-y-auto custom-scrollbar min-h-0 pt-0.5 pb-1.5">
        {zoneStats.map(({ zone, avg, alerts, data: zBins }) => {
          const isFiltered = activeZoneFilter && activeZoneFilter !== zone;
          
          return (
            <div 
              key={zone} 
              className="flex flex-col p-2.5 rounded-lg border transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: isFiltered ? 'var(--border-subtle)' : 'var(--border-active)',
                opacity: isFiltered ? 0.35 : 1,
                boxShadow: !isFiltered ? '0 0 8px rgba(0, 163, 173, 0.05)' : 'none'
              }}
              onClick={() => setFilter('zone', activeZoneFilter === zone ? null : zone)}
            >
              {/* Zone Header Stat Block */}
              <div className="flex items-center justify-between border-b pb-1 mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-primary)' }}>
                  {zone}
                </span>
                <span className="text-[9px] font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
                  Avg {avg}% <span className="opacity-50">·</span> <span style={{ color: alerts > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>{alerts} alert{alerts !== 1 ? 's' : ''}</span>
                </span>
              </div>

              {/* Heatmap Grid cells */}
              <div className="flex-1 flex flex-col gap-1 justify-center">
                {Array.from(new Set(zBins.map((bin) => bin.aisle))).slice(0, 6).map((aisleName, aIdx) => {
                  const aisleData = zBins.filter(d => d.aisle === aisleName).slice(0, 8);

                  return (
                    <div key={aisleName} className="flex gap-1.5 items-center justify-between">
                      <span className="text-[8px] font-mono font-bold w-4 text-left" style={{ color: 'var(--text-secondary)' }}>
                        A{aIdx + 1}
                      </span>
                      <div className="flex gap-[3px] flex-1 justify-between">
                        {aisleData.map((bin, bIdx) => (
                          <div
                            key={bin.bin}
                            className="relative rounded-[1px] transition-all duration-200 hover:outline hover:outline-1 hover:outline-white hover:z-10 cursor-crosshair"
                            style={{
                              backgroundColor: mounted ? getColor(bin.utilizationPct) : 'var(--bg-elevated)',
                              flex: '1 1 0%',
                              height: '11px',
                              maxWidth: '16px'
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredCell({ x: rect.left + rect.width / 2, y: rect.top, data: bin });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {/* Alert indicator dot */}
                            {bin.hasAlert && (
                              <div 
                                className="absolute top-[1.5px] right-[1.5px] w-1 h-1 rounded-full bg-[var(--accent-red)]"
                                style={{ boxShadow: '0 0 2px var(--accent-red)' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover Tooltip Portal */}
      {hoveredCell && (
        <div 
          className="fixed pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+8px)] z-[9999]"
          style={{ left: hoveredCell.x, top: hoveredCell.y }}
        >
          <TooltipContent data={hoveredCell.data} />
        </div>
      )}

      {/* Bottom Area: Heatmap Legend */}
      <div className="mt-auto pt-2 border-t flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          {[
            { label: '0-30%', color: 'var(--bg-elevated)' },
            { label: '31-60%', color: 'rgba(0,163,173,0.4)' },
            { label: '61-85%', color: 'rgba(0,163,173,0.9)' },
            { label: '86-99%', color: 'var(--accent-amber)' },
            { label: '100%', color: 'var(--accent-red)' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: item.color }} />
              <span className="text-[8px] font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <span className="text-[8px] font-bold font-mono text-[var(--text-secondary)] uppercase tracking-wider">
          Total: {data.length} Bins
        </span>
      </div>
    </div>
  );
}
