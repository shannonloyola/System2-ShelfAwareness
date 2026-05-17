"use client";

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { useDashboardStore } from '@/store/dashboardStore';

const MOCK_DATA = [
  { sku: 'MED-001', name: 'Amoxicillin 500mg', stockLevel: 45, velocity: 8.2, value: 125000, category: 'Antibiotics' },
  { sku: 'MED-002', name: 'Ibuprofen 400mg', stockLevel: 320, velocity: 12.1, value: 250000, category: 'Pain Relief' },
  { sku: 'MED-003', name: 'Metformin 500mg', stockLevel: 80, velocity: 3.5, value: 65000, category: 'Endocrinology' },
  { sku: 'MED-004', name: 'Omeprazole 20mg', stockLevel: 410, velocity: 4.2, value: 110000, category: 'Gastroenterology' },
  { sku: 'MED-005', name: 'Amlodipine 5mg', stockLevel: 15, velocity: 9.8, value: 95000, category: 'Cardiology' },
  { sku: 'MED-006', name: 'Paracetamol 500mg', stockLevel: 480, velocity: 14.5, value: 180000, category: 'Pain Relief' },
  { sku: 'MED-007', name: 'Azithromycin 250mg', stockLevel: 55, velocity: 6.1, value: 145000, category: 'Antibiotics' },
  { sku: 'MED-008', name: 'Losartan 50mg', stockLevel: 120, velocity: 1.2, value: 45000, category: 'Cardiology' },
  { sku: 'MED-009', name: 'Simvastatin 20mg', stockLevel: 250, velocity: 2.5, value: 78000, category: 'Cardiology' },
  { sku: 'MED-010', name: 'Ceftriaxone 1g', stockLevel: 25, velocity: 5.5, value: 210000, category: 'Antibiotics' },
  // Add more realistic data
  { sku: 'MED-011', name: 'Salbutamol Inhaler', stockLevel: 90, velocity: 11.2, value: 155000, category: 'Respiratory' },
  { sku: 'MED-012', name: 'Insulin Glargine', stockLevel: 110, velocity: 3.8, value: 890000, category: 'Endocrinology' },
  { sku: 'MED-013', name: 'Ciprofloxacin 500mg', stockLevel: 65, velocity: 7.4, value: 112000, category: 'Antibiotics' },
  { sku: 'MED-014', name: 'Aspirin 81mg', stockLevel: 350, velocity: 8.5, value: 42000, category: 'Cardiology' },
  { sku: 'MED-015', name: 'Levothyroxine 50mcg', stockLevel: 180, velocity: 4.1, value: 67000, category: 'Endocrinology' },
];

const THRESHOLD_X = 100;
const THRESHOLD_Y = 5;

const getQuadrantColor = (stock: number, velocity: number) => {
  if (stock <= THRESHOLD_X && velocity >= THRESHOLD_Y) return 'var(--accent-red)'; // Critical
  if (stock > THRESHOLD_X && velocity >= THRESHOLD_Y) return 'var(--accent-green)'; // Healthy
  if (stock <= THRESHOLD_X && velocity < THRESHOLD_Y) return 'var(--accent-amber)'; // Monitor
  return 'var(--accent-teal)'; // Overstock
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isCritical = data.stockLevel <= THRESHOLD_X && data.velocity >= THRESHOLD_Y;
    const quadColor = getQuadrantColor(data.stockLevel, data.velocity);
    
    return (
      <div className="p-3 border rounded shadow-lg flex flex-col gap-1 min-w-[200px]" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: quadColor }}>
        <p className="text-[12px] font-bold font-sans" style={{ color: 'var(--text-primary)' }}>{data.name}</p>
        <p className="text-[10px] font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>{data.sku}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Stock</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{data.stockLevel} units</span>
          </div>
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Velocity</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{data.velocity}/day</span>
          </div>
          <div className="flex flex-col col-span-2 mt-1">
            <span style={{ color: 'var(--text-secondary)' }}>Financial Exposure</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>₱{data.value.toLocaleString()}</span>
          </div>
        </div>
        
        {isCritical && (
          <div className="mt-2.5 pt-2 border-t flex flex-col gap-1" style={{ borderColor: 'var(--border-subtle)' }}>
            <div 
              className="flex items-center justify-between rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer border"
              style={{ backgroundColor: 'rgba(0,163,173,0.1)', color: 'var(--accent-teal)', borderColor: 'var(--accent-teal)' }}
              title="Reorder recommended — link to Procurement module in Phase 2"
            >
              <span>→ Raise PO</span>
              <span className="text-[8px] opacity-75">(Phase 2)</span>
            </div>
            <span className="text-[8px] italic leading-tight text-center" style={{ color: 'var(--text-secondary)' }}>
              Reorder recommended — link to Procurement in Phase 2
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom SVG layer for quadrant labels
const QuadrantLabels = () => {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <text x="25%" y="15%" textAnchor="middle" fill="var(--accent-red)" opacity={0.3} fontSize="12" fontWeight="bold" fontFamily="var(--font-label)">🔴 CRITICAL</text>
      <text x="75%" y="15%" textAnchor="middle" fill="var(--accent-green)" opacity={0.3} fontSize="12" fontWeight="bold" fontFamily="var(--font-label)">✅ HEALTHY</text>
      <text x="25%" y="85%" textAnchor="middle" fill="var(--accent-amber)" opacity={0.3} fontSize="12" fontWeight="bold" fontFamily="var(--font-label)">⚠ MONITOR</text>
      <text x="75%" y="85%" textAnchor="middle" fill="var(--accent-teal)" opacity={0.3} fontSize="12" fontWeight="bold" fontFamily="var(--font-label)">📦 OVERSTOCK</text>
    </svg>
  );
};

export default function CriticalStockRiskMatrix() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeSkuFilter = useDashboardStore((state) => state.filters.sku);

  const processedData = useMemo(() => {
    return MOCK_DATA.map(d => ({
      ...d,
      opacity: (activeSkuFilter && activeSkuFilter !== d.sku) ? 0.2 : 0.8
    }));
  }, [activeSkuFilter]);

  const criticalCount = useMemo(() => {
    return MOCK_DATA.filter(d => d.stockLevel <= THRESHOLD_X && d.velocity >= THRESHOLD_Y).length;
  }, []);

  return (
    <div className="flex flex-col h-full w-full justify-between">
      <div className="relative flex-1 min-h-0">
        <QuadrantLabels />
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis 
              type="number" 
              dataKey="stockLevel" 
              name="Stock Level" 
              domain={[0, 500]}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
              label={{ value: 'Stock On Hand (units)', position: 'bottom', fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
            />
            <YAxis 
              type="number" 
              dataKey="velocity" 
              name="Velocity" 
              domain={[0, 15]}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
              label={{ value: 'Avg Daily Movement', angle: -90, position: 'left', fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
            />
            <ZAxis type="number" dataKey="value" range={[16, 256]} /> {/* 4px to 16px radius (area = r^2) */}
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            
            <ReferenceLine x={THRESHOLD_X} stroke="var(--text-secondary)" strokeDasharray="3 3" opacity={0.5} />
            <ReferenceLine y={THRESHOLD_Y} stroke="var(--text-secondary)" strokeDasharray="3 3" opacity={0.5} />
            
            <Scatter 
              name="Products" 
              data={processedData} 
              animationDuration={1200}
              onClick={(e: any) => {
                if (e && e.sku) {
                  setFilter('sku', activeSkuFilter === e.sku ? null : e.sku);
                }
              }}
              className="cursor-pointer transition-opacity"
            >
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getQuadrantColor(entry.stockLevel, entry.velocity)} 
                  opacity={entry.opacity} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Red Action Footer Bar */}
      <div 
        className="p-2 px-3 rounded flex items-center justify-between border-t mt-1.5 shrink-0" 
        style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.04)', 
          borderColor: 'rgba(239, 68, 68, 0.2)' 
        }}
      >
        <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-label)' }}>
          ⚡ {criticalCount} products require immediate reorder action
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-[var(--accent-red)] opacity-95">
          Critical Quadrant
        </span>
      </div>
    </div>
  );
}
