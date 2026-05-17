"use client";

import { useEffect, useState, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { EmptyDashboardState, useDashboardData } from '../DashboardDataContext';

export default function TransferVelocityFunnel() {
  const [mounted, setMounted] = useState(false);
  const activeRole = useDashboardStore(state => state.activeRole);
  const { data: dashboardData, isLoading } = useDashboardData();
  const funnelData = useMemo(() => dashboardData?.operations?.transferVelocityFunnel || [], [dashboardData]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Find bottleneck
  const maxHours = Math.max(...funnelData.map(d => d.avgHoursInStage), 0);
  const bottleneckStage = funnelData.find(d => d.avgHoursInStage === maxHours)?.stage;

  const initialCount = funnelData[0]?.count || 0;
  const finalCount = funnelData[funnelData.length - 1]?.count || 0;
  const overallConv = ((finalCount / initialCount) * 100).toFixed(1);

  // Layout math
  const width = 300;
  const height = 200;
  const stageHeight = height / Math.max(1, funnelData.length);
  
  // Calculate widths for each stage based on count relative to max count (156)
  // Max width is 300, min width maybe 100
  const getStageWidth = (count: number) => {
    return Math.max(120, (count / initialCount) * width);
  };

  if (!funnelData.length || initialCount === 0) {
    return <EmptyDashboardState message={isLoading ? "Loading backend transfer data..." : "No transfer velocity data returned by procurement service."} />;
  }

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-2" style={{ overflow: 'hidden' }}>
      <div className="relative w-full max-w-[320px] flex-1" style={{ minHeight: '0' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
          <defs>
            <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-teal)" />
              <stop offset="100%" stopColor="var(--accent-green)" />
            </linearGradient>
            <style>
              {`
                @keyframes pulse-amber {
                  0% { stroke-width: 2; stroke-opacity: 1; }
                  50% { stroke-width: 4; stroke-opacity: 0.5; }
                  100% { stroke-width: 2; stroke-opacity: 1; }
                }
              `}
            </style>
          </defs>

          {funnelData.map((item, i) => {
            const topWidth = getStageWidth(i === 0 ? item.count : funnelData[i-1].count);
            const bottomWidth = getStageWidth(item.count);
            
            const topX = (width - topWidth) / 2;
            const bottomX = (width - bottomWidth) / 2;
            
            const yOffset = i * stageHeight;
            
            // Generate path for the trapezoid
            const points = `
              ${topX},${yOffset + 2} 
              ${topX + topWidth},${yOffset + 2} 
              ${bottomX + bottomWidth},${yOffset + stageHeight - 2} 
              ${bottomX},${yOffset + stageHeight - 2}
            `;

            const isBottleneck = item.stage === bottleneckStage;
            const hasHighHours = item.avgHoursInStage > 12;

            return (
              <g 
                key={item.stage} 
                className="transition-all duration-1000 ease-out origin-top"
                style={{ 
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'scaleY(1)' : 'scaleY(0)',
                  transitionDelay: `${i * 150}ms`
                }}
              >
                {/* Main Trapezoid */}
                <polygon 
                  points={points} 
                  fill="url(#funnelGrad)"
                  stroke={isBottleneck ? 'var(--accent-amber)' : 'none'}
                  style={isBottleneck ? { animation: 'pulse-amber 2s infinite' } : {}}
                />
                
                {/* Amber Overlay for High Hours */}
                {hasHighHours && (
                  <polygon 
                    points={points} 
                    fill="var(--accent-amber)"
                    opacity="0.3"
                  />
                )}

                {/* Center Label */}
                <text 
                  x={width / 2} 
                  y={yOffset + stageHeight / 2} 
                  textAnchor="middle" 
                  alignmentBaseline="middle"
                  fill="#ffffff" 
                  fontSize="12" 
                  fontWeight="bold"
                  fontFamily="var(--font-data)"
                  className="drop-shadow-md"
                >
                  {item.count}
                </text>
                <text 
                  x={width / 2} 
                  y={yOffset + stageHeight / 2 + 12} 
                  textAnchor="middle" 
                  fill="rgba(255,255,255,0.8)" 
                  fontSize="9" 
                  fontFamily="var(--font-label)"
                >
                  {item.stage}
                </text>

                {/* Left Side: Avg Hours */}
                {item.avgHoursInStage > 0 && (
                  <text 
                    x={Math.min(topX, bottomX) - 10} 
                    y={yOffset + stageHeight / 2} 
                    textAnchor="end" 
                    alignmentBaseline="middle"
                    fill="var(--text-secondary)" 
                    fontSize="10" 
                    fontFamily="var(--font-label)"
                  >
                    ⏱ {item.avgHoursInStage}h
                  </text>
                )}

                {/* Bottleneck Badge */}
                {isBottleneck && (
                  <g transform={`translate(${Math.min(topX, bottomX) - 10}, ${yOffset + stageHeight / 2 - 15})`}>
                    <rect x="-70" y="-8" width="65" height="14" rx="2" fill="var(--accent-amber)" />
                    <text x="-37.5" y="2" textAnchor="middle" fill="#000" fontSize="8" fontWeight="bold" fontFamily="var(--font-label)">
                      ⚠ BOTTLENECK
                    </text>
                  </g>
                )}

                {/* Right Side: Dropoff (rendered below current stage connecting to next) */}
                {item.dropoffCount > 0 && (
                  <g transform={`translate(${Math.max(topX, bottomX) + 10}, ${yOffset - stageHeight / 2})`}>
                    <path d="M 0,-5 L 10,0 L 0,5 Z" fill="var(--accent-red)" />
                    <text x="14" y="3" fill="var(--accent-red)" fontSize="9" fontWeight="bold" fontFamily="var(--font-label)">
                      {item.dropoffCount} lost ({item.dropoffPct}%)
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Prescriptive Bottleneck Footer Bar */}
      <div 
        className="w-full p-2 px-3 rounded flex flex-col md:flex-row items-center justify-between border-t mt-2 shrink-0 gap-1" 
        style={{ 
          backgroundColor: 'rgba(245, 158, 11, 0.04)', 
          borderColor: 'rgba(245, 158, 11, 0.2)' 
        }}
      >
        <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-label)' }}>
          Bottleneck: {bottleneckStage || "None"} averaging {maxHours.toFixed(1)}h - {overallConv}% completion flow
        </span>
        <a 
          href="/warehouse" 
          className="text-[9.5px] font-bold underline hover:opacity-85 transition-opacity cursor-pointer whitespace-nowrap shrink-0" 
          style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-label)' }}
        >
          [View Pending Approvals →]
        </a>
      </div>
    </div>
  );
}
