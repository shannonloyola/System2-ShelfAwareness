"use client";

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Dot
} from 'recharts';
import { useDashboardStore } from '@/store/dashboardStore';

// Generate 90 days of mock data
const generateMockData = () => {
  const data = [];
  const now = new Date();
  let currentValue = 12000000;
  
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    
    // Create an anomaly on day 45
    if (i === 45) {
      currentValue = 9000000; // Big drop
    } else {
      currentValue = currentValue + (Math.random() * 500000 - 200000); // Random walk with upward trend
    }
    
    data.push({
      date: d.toISOString().split('T')[0],
      value: currentValue,
      category: 'total'
    });
  }
  return data;
};

const formatToMillions = (value: number) => {
  if (value >= 1000000) {
    return `₱${(value / 1000000).toFixed(1)}M`;
  }
  return `₱${value.toLocaleString()}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="p-3 border rounded shadow-lg" style={{ backgroundColor: '#1A3A5C', borderColor: 'var(--accent-teal)' }}>
        <p className="text-[11px] mb-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>{label}</p>
        <p className="text-[14px] font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-data)' }}>
          ₱{dataPoint.value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
        </p>
        {dataPoint.isAnomaly && (
          <p className="text-[11px] font-bold mt-1" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-label)' }}>
            ⚠ Anomaly Detected
          </p>
        )}
      </div>
    );
  }
  return null;
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.isAnomaly) {
    return (
      <circle cx={cx} cy={cy} r={4} fill="var(--accent-red)" stroke="none" />
    );
  }
  return null;
};

export default function InventoryValuationTrend() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const dateRange = useDashboardStore((state) => state.dateRange);

  const processedData = useMemo(() => {
    let data = generateMockData();
    
    if (dateRange === '7D') data = data.slice(-7);
    else if (dateRange === '30D') data = data.slice(-30);
    
    // Compute Z-score
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
    
    return data.map(d => ({
      ...d,
      zScore: Math.abs((d.value - mean) / stdDev),
      isAnomaly: Math.abs((d.value - mean) / stdDev) > 2.0
    }));
  }, [dateRange]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={processedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        onClick={(e) => {
          if (e && e.activePayload) {
            // Setting filter by date as an example
            setFilter('status', e.activePayload[0].payload.date);
          }
        }}
      >
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis 
          dataKey="date" 
          tickFormatter={(val, i) => i % 14 === 0 ? val : ''} 
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
        />
        <YAxis 
          tickFormatter={formatToMillions}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="var(--accent-teal)" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorValue)" 
          animationDuration={1200}
          activeDot={{ r: 6, fill: 'var(--accent-teal)', stroke: 'var(--bg-surface)', strokeWidth: 2 }}
          dot={<CustomDot />}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
