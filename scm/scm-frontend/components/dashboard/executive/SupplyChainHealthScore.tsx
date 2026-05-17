"use client";

import { useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

const MOCK_METRICS = {
  fillRate: 94.2,
  stockHealth: 82.5,
  budgetHealth: 68.4,
  supplierScore: 88.0
};

export default function SupplyChainHealthScore() {
  const activeRole = useDashboardStore((state) => state.activeRole);
  
  // Weights
  const weights = {
    fillRate: 0.35,
    stockHealth: 0.25,
    budgetHealth: 0.20,
    supplierScore: 0.20
  };

  // Mock fluctuation based on role change just to show reactivity
  const metrics = useMemo(() => {
    const shift = activeRole === 'Executive' ? 0 : activeRole === 'Operations' ? 5 : -5;
    return {
      fillRate: Math.min(100, Math.max(0, MOCK_METRICS.fillRate + shift)),
      stockHealth: Math.min(100, Math.max(0, MOCK_METRICS.stockHealth + shift)),
      budgetHealth: Math.min(100, Math.max(0, MOCK_METRICS.budgetHealth + shift)),
      supplierScore: Math.min(100, Math.max(0, MOCK_METRICS.supplierScore + shift))
    };
  }, [activeRole]);

  const compositeScore = useMemo(() => {
    return (
      metrics.fillRate * weights.fillRate +
      metrics.stockHealth * weights.stockHealth +
      metrics.budgetHealth * weights.budgetHealth +
      metrics.supplierScore * weights.supplierScore
    );
  }, [metrics]);

  const getLetterGrade = (score: number) => {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--accent-green)'; // Green
    if (score >= 60) return 'var(--accent-amber)'; // Amber
    return 'var(--accent-red)'; // Red
  };

  // Generate 30 points that end at compositeScore for sparkline
  const sparklinePoints = useMemo(() => {
    const base = [81, 82.5, 81.5, 83.2, 82, 84, 83.5, 83.8, 83.1, 84.5, 84.1, 84.9, 84.2, 85.5, 84.8, 85.0, 84.3, 84.7, 85.2, 84.6, 85.8, 85.1, 84.9, 85.6, 85.0, 85.4, 84.8, 85.9, 85.3, compositeScore];
    const scale = compositeScore / 84.9;
    return base.map(p => p * scale);
  }, [compositeScore]);

  // Construct SVG Path for sparkline
  const sparklinePath = useMemo(() => {
    const width = 80;
    const height = 24;
    const minVal = 60;
    const maxVal = 100;
    
    const coords = sparklinePoints.map((val, idx) => {
      const x = (idx / (sparklinePoints.length - 1)) * width;
      const y = height - ((val - minVal) / (maxVal - minVal)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return {
      line: `M ${coords.join(' L ')}`,
      area: `M 0,${height} L ${coords.join(' L ')} L ${width},${height} Z`
    };
  }, [sparklinePoints]);

  // Find lowest score
  const subScores = useMemo(() => [
    { label: 'Fill Rate Score (35%)', val: metrics.fillRate, name: 'Fill Rate' },
    { label: 'Stock Health Score (25%)', val: metrics.stockHealth, name: 'Stock Health' },
    { label: 'Budget Health (20%)', val: metrics.budgetHealth, name: 'Budget Health' },
    { label: 'Supplier Score (20%)', val: metrics.supplierScore, name: 'Supplier Score' },
  ], [metrics]);

  const lowestSubScore = useMemo(() => {
    return subScores.reduce((prev, curr) => prev.val < curr.val ? prev : curr);
  }, [subScores]);

  const compositeColor = getScoreColor(compositeScore);

  return (
    <div className="flex flex-col h-full w-full justify-between pb-1 pt-1">
      {/* Top Section: Grade, Score, Sparkline */}
      <div className="flex items-center justify-between border-b pb-2 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-baseline gap-2.5">
          <span className="text-[44px] font-bold font-mono leading-none tracking-tighter" style={{ color: compositeColor }}>
            {getLetterGrade(compositeScore)}
          </span>
          <div className="flex flex-col">
            <span className="text-[16px] font-bold font-mono leading-none" style={{ color: 'var(--text-primary)' }}>
              {compositeScore.toFixed(1)}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
              Composite
            </span>
          </div>
        </div>

        {/* Predictive Sparkline */}
        <div className="flex flex-col items-end gap-1">
          <div className="relative">
            <svg width="80" height="24" className="overflow-visible">
              <defs>
                <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={compositeColor} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={compositeColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={sparklinePath.area} fill="url(#sparkline-grad)" />
              <path d={sparklinePath.line} fill="none" stroke={compositeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {/* Endpoint Dot */}
              <circle cx="80" cy={24 - ((compositeScore - 60) / 40) * 24} r="2.5" fill={compositeColor} />
            </svg>
          </div>
          <span className="text-[8px] font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
            30D Sparkline
          </span>
        </div>
      </div>

      {/* Sub-score Bars */}
      <div className="flex-1 flex flex-col gap-2 mt-2 justify-center">
        {subScores.map((sub, i) => (
          <div key={i} className="flex flex-col gap-0.5 w-full">
            <div className="flex justify-between items-center text-[9px] font-bold tracking-wide uppercase" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
              <span>{sub.label}</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{sub.val.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <div 
                className="h-full rounded-full transition-all duration-1000" 
                style={{ width: `${sub.val}%`, backgroundColor: getScoreColor(sub.val) }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actionable Risk Factor Footer Callout */}
      <div 
        className="mt-2 p-2 rounded border flex items-start gap-1.5 shrink-0" 
        style={{ 
          backgroundColor: 'rgba(239, 68, 68, 0.03)', 
          borderColor: 'rgba(239, 68, 68, 0.15)' 
        }}
      >
        <span className="text-[11px] leading-none mt-0.5">⚠️</span>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-label)' }}>
            Biggest Risk Factor
          </span>
          <span className="text-[10px] leading-tight mt-0.5 font-mono" style={{ color: 'var(--text-primary)' }}>
            {lowestSubScore.name} is low ({lowestSubScore.val.toFixed(1)}%), dragging down composite score. Review recommended.
          </span>
        </div>
      </div>
    </div>
  );
}
