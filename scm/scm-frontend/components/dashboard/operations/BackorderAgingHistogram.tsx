"use client";

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useDashboardStore } from '@/store/dashboardStore';

const MOCK_DATA = [
  { bucket: '<7 days',   emoji: '🟢 <7d',   count: 42, historicalAvg: 40, historicalStdDev: 5, value: 1250000, critical: 2,  avgDaysWaiting: 3.2,  color: '#10B981' },
  { bucket: '7–14 days', emoji: '🟡 7–14d', count: 28, historicalAvg: 30, historicalStdDev: 6, value: 845000,  critical: 5,  avgDaysWaiting: 10.5, color: '#F59E0B' },
  { bucket: '14–30 days',emoji: '🟠 14–30d',count: 15, historicalAvg: 14, historicalStdDev: 4, value: 620000,  critical: 8,  avgDaysWaiting: 22.1, color: '#f97316' },
  { bucket: '30+ days',  emoji: '🔴 30+d',  count: 26, historicalAvg: 8,  historicalStdDev: 3, value: 410000,  critical: 9,  avgDaysWaiting: 45.6, color: '#EF4444' }, // Z = (26-8)/3 = 6.0 (>2.0)
].map(d => ({ ...d, isAnomaly: Math.abs(d.count - d.historicalAvg) / d.historicalStdDev > 2.0 }));

const formatPHP = (val: number) => {
  if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`;
  return `₱${(val / 1000).toFixed(0)}k`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 border rounded shadow-lg min-w-[180px]" style={{ backgroundColor: '#1A3A5C', borderColor: data.color }}>
        <p className="text-[12px] font-bold text-white mb-2">{data.bucket} Aging</p>
        <div className="flex flex-col gap-1 text-[11px] font-mono">
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Orders:</span>
            <span className="font-bold text-white">{data.count}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Value:</span>
            <span className="font-bold text-white">₱{data.value.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Critical:</span>
            <span className="font-bold text-red-400">⚡ {data.critical}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Avg Wait:</span>
            <span className="font-bold text-white">{data.avgDaysWaiting} days</span>
          </div>
          {data.isAnomaly && (
            <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-col text-[10px]">
              <span className="font-bold" style={{ color: 'var(--accent-red)' }}>⚠ STATISTICAL ANOMALY</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {(Math.abs(data.count - data.historicalAvg) / data.historicalStdDev).toFixed(1)}σ above mean (μ:{data.historicalAvg})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom shape to draw the critical badge above the group
const CustomizedCountLabel = (props: any) => {
  const { x, y, width, value, index, data } = props;
  const isAnomaly = data && data[index] && data[index].isAnomaly;
  return (
    <g>
      <text x={x + width / 2} y={y - 5} fill="var(--text-primary)" fontSize="10" fontFamily="var(--font-data)" textAnchor="middle" fontWeight="bold">
        {value}
      </text>
      {isAnomaly && (
        <text x={x + width / 2} y={y - 18} fill="var(--accent-red)" fontSize="14" textAnchor="middle">
          ⚠
        </text>
      )}
    </g>
  );
};

const CustomizedValueLabel = (props: any) => {
  const { x, y, width, value } = props;
  return (
    <text x={x + width / 2} y={y - 5} fill="var(--text-primary)" fontSize="9" fontFamily="var(--font-data)" textAnchor="middle" fontWeight="bold">
      {formatPHP(value)}
    </text>
  );
};

// SVG Badge for critical items (positioned manually based on chart axes, but simpler to use a custom tick or just rely on Tooltip + absolute DOM if possible. 
// Recharts XAxis tick can be customized to show the badge.
const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const item = MOCK_DATA.find(d => d.emoji === payload.value);
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={12} dy={0} textAnchor="middle" fill={item?.color || '#8899AA'} fontSize={10} fontFamily="var(--font-label)" fontWeight="bold">
        {payload.value}
      </text>
      {item && item.critical > 0 && (
        <g transform="translate(0, 26)">
          <rect x={-20} y={-10} width={40} height={16} rx={8} fill="rgba(239,68,68,0.1)" stroke="rgba(239,68,68,0.3)" />
          <text x={0} y={1.5} textAnchor="middle" fill="var(--accent-red)" fontSize={9} fontWeight="bold" fontFamily="var(--font-label)">
            ⚡ {item.critical}
          </text>
        </g>
      )}
    </g>
  );
};

export default function BackorderAgingHistogram() {
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeBucket = useDashboardStore(state => state.filters.bucket);
  
  const totalOrders = MOCK_DATA.reduce((acc, d) => acc + d.count, 0);
  const totalValue = MOCK_DATA.reduce((acc, d) => acc + d.value, 0);
  const avgWait = (MOCK_DATA.reduce((acc, d) => acc + (d.avgDaysWaiting * d.count), 0) / totalOrders).toFixed(1);
  const oldest = Math.max(...MOCK_DATA.map(d => d.avgDaysWaiting * 1.5)).toFixed(0); // mock calculation

  return (
    <div className="flex flex-col h-full w-full relative pt-2 pb-2">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={MOCK_DATA}
            margin={{ top: 20, right: 10, left: -20, bottom: 42 }}
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis 
              dataKey="emoji" 
              tick={<CustomXAxisTick />}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
            />
            
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tickFormatter={formatPHP}
              tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
              tickLine={false}
              axisLine={false}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            
            <Bar 
              yAxisId="left" 
              dataKey="count" 
              fill="var(--accent-teal)" 
              radius={[2, 2, 0, 0]}
              animationDuration={1000}
              label={(props: any) => <CustomizedCountLabel {...props} data={MOCK_DATA} />}
              onClick={(e: any) => {
                if (e && e.bucket) setFilter('bucket', activeBucket === e.bucket ? null : e.bucket);
              }}
              className="cursor-pointer transition-opacity"
            >
              {MOCK_DATA.map((entry, index) => (
                <Cell key={`cell-l-${index}`} opacity={activeBucket && activeBucket !== entry.bucket ? 0.3 : 1} />
              ))}
            </Bar>
            
            <Bar 
              yAxisId="right" 
              dataKey="value" 
              fill="var(--accent-amber)" 
              radius={[2, 2, 0, 0]}
              animationDuration={1000}
              label={<CustomizedValueLabel />}
              onClick={(e: any) => {
                if (e && e.bucket) setFilter('bucket', activeBucket === e.bucket ? null : e.bucket);
              }}
              className="cursor-pointer transition-opacity"
            >
              {MOCK_DATA.map((entry, index) => (
                <Cell key={`cell-r-${index}`} opacity={activeBucket && activeBucket !== entry.bucket ? 0.3 : 0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t px-4 text-[10px]" style={{ borderColor: 'var(--border-subtle)', fontFamily: 'var(--font-label)', minHeight: '34px', flexShrink: 0 }}>
        <div className="flex flex-col">
          <span style={{ color: 'var(--text-secondary)' }}>Total Backorders</span>
          <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{totalOrders}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--text-secondary)' }}>Value at Risk</span>
          <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>₱{totalValue.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--text-secondary)' }}>Avg Wait</span>
          <span className="font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{avgWait} days</span>
        </div>
        <div className="flex flex-col">
          <span style={{ color: 'var(--text-secondary)' }}>Oldest</span>
          <span className="font-bold text-red-400 font-mono">{oldest} days</span>
        </div>
      </div>
    </div>
  );
}
