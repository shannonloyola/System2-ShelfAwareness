"use client";

import { useEffect, useState, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

interface BoxPlotData {
  supplier: string;
  supplierId: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
  mean: number;
  unit: string;
}

const MOCK_DATA: BoxPlotData[] = [
  { supplier: 'GlobalMed Supply', supplierId: 'SUP-003', min: 4, q1: 6, median: 8, q3: 11, max: 13, outliers: [], mean: 8.5, unit: 'days' },
  { supplier: 'CarePlus Logic', supplierId: 'SUP-005', min: 7, q1: 10, median: 12, q3: 15, max: 21, outliers: [], mean: 12.8, unit: 'days' },
  { supplier: 'MedLine PH', supplierId: 'SUP-001', min: 8, q1: 11, median: 14, q3: 18, max: 28, outliers: [32, 35], mean: 15.1, unit: 'days' },
  { supplier: 'PharmaDist Inc', supplierId: 'SUP-002', min: 10, q1: 15, median: 19, q3: 24, max: 29, outliers: [34], mean: 19.5, unit: 'days' },
  { supplier: 'BioTech Imports', supplierId: 'SUP-004', min: 15, q1: 22, median: 27, q3: 33, max: 38, outliers: [42, 45], mean: 28.2, unit: 'days' },
];

export default function POLeadTimeDistribution() {
  const [mounted, setMounted] = useState(false);
  const [hoveredData, setHoveredData] = useState<{ x: number, y: number, data: BoxPlotData } | null>(null);
  
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeSupplier = useDashboardStore(state => state.filters.supplier);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Geometry
  const width = 400;
  const height = 280;
  const margin = { top: 20, right: 20, bottom: 30, left: 140 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const minX = 0;
  const maxX = 45;
  const xScale = (val: number) => (val / maxX) * innerWidth;
  
  const rowHeight = innerHeight / MOCK_DATA.length;
  
  const handleSvgMouseLeave = () => setHoveredData(null);

  return (
    <div className="flex flex-col h-full w-full relative pt-2">
      <div className="flex-1 w-full min-h-0 relative">
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${width} ${height}`} 
          preserveAspectRatio="none"
          onMouseLeave={handleSvgMouseLeave}
        >
          {/* Outlier Zone Shading (>30) */}
          <rect 
            x={margin.left + xScale(30)} 
            y={margin.top} 
            width={innerWidth - xScale(30)} 
            height={innerHeight} 
            fill="var(--accent-red)" 
            opacity={0.05} 
          />

          {/* X Axis Grid Lines & Labels */}
          {[0, 10, 20, 30, 40].map(tick => (
            <g key={`tick-${tick}`} transform={`translate(${margin.left + xScale(tick)}, 0)`}>
              <line y1={margin.top} y2={margin.top + innerHeight} stroke="var(--border-subtle)" strokeDasharray="2 2" />
              <text y={margin.top + innerHeight + 15} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-label)">
                {tick}
              </text>
            </g>
          ))}
          <text x={margin.left + innerWidth / 2} y={margin.top + innerHeight + 28} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-label)">
            Lead Time (Days)
          </text>

          {/* Target Line (14 Days) */}
          <g transform={`translate(${margin.left + xScale(14)}, 0)`}>
            <line y1={margin.top - 10} y2={margin.top + innerHeight} stroke="var(--accent-green)" strokeDasharray="4 2" strokeWidth={1.5} />
            <text y={margin.top - 12} textAnchor="middle" fill="var(--accent-green)" fontSize="9" fontFamily="var(--font-label)" fontWeight="bold">
              Target: 14d
            </text>
          </g>

          {/* Box Plots */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {MOCK_DATA.map((d, i) => {
              const yCenter = (i * rowHeight) + (rowHeight / 2);
              const boxHeight = rowHeight * 0.5;
              const isFaded = activeSupplier && activeSupplier !== d.supplier && !activeSupplier.includes(d.supplier.split(' ')[0]);
              const isBad = d.median > 14;
              
              // Map to original supplier names used in Scorecard for accurate cross-filtering
              const originalSupplierName = activeSupplier === 'MedLine Philippines' && d.supplier === 'MedLine PH' ? 'MedLine Philippines' : d.supplier;

              return (
                <g 
                   key={d.supplierId} 
                   className="cursor-pointer transition-opacity duration-300"
                   style={{ 
                     opacity: isFaded ? 0.3 : 1,
                     transform: mounted ? 'translateX(0)' : 'translateX(-20px)',
                     transitionDelay: `${i * 100}ms`
                   }}
                   onClick={() => setFilter('supplier', activeSupplier === originalSupplierName ? null : originalSupplierName)}
                   onMouseMove={(e) => {
                     const rect = e.currentTarget.getBoundingClientRect();
                     setHoveredData({ x: e.clientX, y: rect.top, data: d });
                   }}
                >
                  {/* Y Axis Label */}
                  <text 
                    x={-10} 
                    y={yCenter} 
                    textAnchor="end" 
                    alignmentBaseline="middle" 
                    fill="var(--text-primary)" 
                    fontSize="10" 
                    fontFamily="var(--font-label)"
                  >
                    {d.supplier}
                  </text>

                  {/* Whiskers (Line from min to max) */}
                  <line 
                    x1={xScale(d.min)} 
                    y1={yCenter} 
                    x2={xScale(d.max)} 
                    y2={yCenter} 
                    stroke="var(--text-secondary)" 
                    strokeWidth={1} 
                  />
                  {/* Min/Max Caps */}
                  <line x1={xScale(d.min)} y1={yCenter - boxHeight/4} x2={xScale(d.min)} y2={yCenter + boxHeight/4} stroke="var(--text-secondary)" strokeWidth={1} />
                  <line x1={xScale(d.max)} y1={yCenter - boxHeight/4} x2={xScale(d.max)} y2={yCenter + boxHeight/4} stroke="var(--text-secondary)" strokeWidth={1} />

                  {/* IQR Box (Q1 to Q3) */}
                  <rect 
                    x={xScale(d.q1)} 
                    y={yCenter - boxHeight/2} 
                    width={xScale(d.q3) - xScale(d.q1)} 
                    height={boxHeight}
                    fill={isBad ? 'var(--accent-amber)' : 'var(--accent-teal)'}
                    fillOpacity={0.3}
                    stroke={isBad ? 'var(--accent-amber)' : 'var(--accent-teal)'}
                    strokeWidth={1}
                    rx={2}
                  />

                  {/* Median Line */}
                  <line 
                    x1={xScale(d.median)} 
                    y1={yCenter - boxHeight/2} 
                    x2={xScale(d.median)} 
                    y2={yCenter + boxHeight/2} 
                    stroke="var(--text-primary)" 
                    strokeWidth={2} 
                  />

                  {/* Mean Diamond ◆ */}
                  <path 
                    d={`M ${xScale(d.mean)},${yCenter - 4} L ${xScale(d.mean) + 4},${yCenter} L ${xScale(d.mean)},${yCenter + 4} L ${xScale(d.mean) - 4},${yCenter} Z`}
                    fill="var(--accent-amber)"
                  />

                  {/* Outlier Dots */}
                  {d.outliers.map((out, idx) => (
                    <circle 
                      key={idx}
                      cx={xScale(out)}
                      cy={yCenter}
                      r={3.5}
                      fill="var(--accent-red)"
                      stroke="var(--bg-base)"
                      strokeWidth={1}
                    />
                  ))}
                  
                  {/* Transparent Overlay for easy hovering */}
                  <rect x={-margin.left} y={yCenter - rowHeight/2} width={width} height={rowHeight} fill="transparent" />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Portal Tooltip */}
      {hoveredData && (
        <div 
          className="fixed pointer-events-none transform -translate-x-1/2 -translate-y-full pb-2 z-50"
          style={{ left: hoveredData.x, top: hoveredData.y - 10 }}
        >
          <div className="p-3 border rounded shadow-lg min-w-[180px]" style={{ backgroundColor: '#1A3A5C', borderColor: 'var(--border-subtle)' }}>
            <p className="text-[12px] font-bold text-white mb-2">{hoveredData.data.supplier}</p>
            <div className="flex flex-col gap-1 text-[10px] font-mono">
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Min</span><span className="text-white">{hoveredData.data.min}d</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Q1 (25th)</span><span className="text-white">{hoveredData.data.q1}d</span></div>
              <div className="flex justify-between font-bold"><span style={{ color: 'var(--text-secondary)' }}>Median</span><span style={{ color: hoveredData.data.median > 14 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{hoveredData.data.median}d</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Q3 (75th)</span><span className="text-white">{hoveredData.data.q3}d</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-secondary)' }}>Max</span><span className="text-white">{hoveredData.data.max}d</span></div>
              
              <div className="flex justify-between mt-1 pt-1 border-t border-[var(--border-subtle)]">
                <span style={{ color: 'var(--accent-amber)' }}>Mean (Avg)</span>
                <span className="font-bold" style={{ color: 'var(--accent-amber)' }}>{hoveredData.data.mean}d</span>
              </div>
              {hoveredData.data.outliers.length > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--accent-red)' }}>Outliers</span>
                  <span className="font-bold" style={{ color: 'var(--accent-red)' }}>{hoveredData.data.outliers.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
