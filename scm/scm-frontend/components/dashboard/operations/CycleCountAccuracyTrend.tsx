"use client";

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { useDashboardStore } from '@/store/dashboardStore';

const generateMockData = () => {
  const data = [];
  let baseAccuracy = 99.6;
  for (let i = 24; i >= 1; i--) {
    let acc = baseAccuracy + (Math.random() * 0.4 - 0.2);
    let discrepancies = Math.floor(Math.random() * 15) + 5;
    
    // Create an anomaly & failure
    if (i === 12) {
      acc = 98.4;
      discrepancies = 45; // Anomaly!
    } else if (i === 5) {
      acc = 98.8; // Just missed target
    }
    const discrepancyCount = Math.floor(Math.random() * 20) + 1;
    data.push({
      week: `W${i + 1}`,
      accuracy: Number(acc.toFixed(2)),
      discrepancyCount,
      systemCount: 4800 + Math.floor(Math.random() * 200),
      actualCount: Math.floor((4800 + Math.random() * 200) * (acc / 100)),
      variancePct: (acc - 100).toFixed(2),
      isAnomaly: false, // will calculate below
    });
  }

  // Calculate Z-Score for discrepancyCount
  const mean = data.reduce((acc, curr) => acc + curr.discrepancyCount, 0) / data.length;
  const stdDev = Math.sqrt(data.reduce((acc, curr) => acc + Math.pow(curr.discrepancyCount - mean, 2), 0) / data.length);
  
  data.forEach(d => {
    const zScore = Math.abs((d.discrepancyCount - mean) / stdDev);
    if (zScore > 2.0) {
      d.isAnomaly = true;
    }
  });

  return data;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 border rounded shadow-lg min-w-[200px]" style={{ backgroundColor: '#1A3A5C', borderColor: data.accuracy < 99 ? 'var(--accent-red)' : 'var(--accent-teal)' }}>
        <p className="text-[12px] font-bold text-white mb-2">{label}</p>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Accuracy</span>
            <span className="font-bold text-white" style={{ color: data.accuracy < 99 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{data.accuracy}%</span>
          </div>
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Variance</span>
            <span className="font-bold text-white">{data.variancePct}%</span>
          </div>
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>System Cnt</span>
            <span className="font-bold text-white">{data.systemCount}</span>
          </div>
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Actual Cnt</span>
            <span className="font-bold text-white">{data.actualCount}</span>
          </div>
          <div className="flex flex-col col-span-2 pt-1 mt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Discrepancies Found</span>
            <span className="font-bold text-white text-[12px]">{data.discrepancyCount}</span>
            {data.isAnomaly && (
              <span className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--accent-red)' }}>⚠ STATISTICAL ANOMALY</span>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom shape for Anomaly Icon above Bar
const CustomizedLabel = (props: any) => {
  const { x, y, width, index, data } = props;
  if (data && data[index] && data[index].isAnomaly) {
    return (
      <text x={x + width / 2} y={y - 10} fill="var(--accent-red)" fontSize="14" textAnchor="middle">
        ⚠
      </text>
    );
  }
  return null;
};

export default function CycleCountAccuracyTrend() {
  const dateRange = useDashboardStore(state => state.dateRange);
  
  const data = useMemo(() => {
    let raw = generateMockData();
    if (dateRange === '7D') raw = raw.slice(-2);
    else if (dateRange === '30D') raw = raw.slice(-4);
    
    const disc = raw.map(d => d.discrepancyCount);
    const mean = disc.reduce((a, b) => a + b, 0) / disc.length;
    const std = Math.sqrt(disc.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / disc.length);

    return raw.map(d => ({
      ...d,
      isAnomaly: Math.abs((d.discrepancyCount - mean) / std) > 2.0
    }));
  }, [dateRange]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis 
          dataKey="week" 
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
        />
        {/* Left Y-Axis for Accuracy % */}
        <YAxis 
          yAxisId="left"
          domain={[95, 100.5]}
          tickFormatter={(val) => `${val}%`}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={false}
        />
        {/* Right Y-Axis for Discrepancy Count */}
        <YAxis 
          yAxisId="right"
          orientation="right"
          domain={[0, 'dataMax + 10']}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={false}
        />
        
        <Tooltip content={<CustomTooltip />} />
        
        <ReferenceLine yAxisId="left" y={99.0} stroke="var(--accent-green)" strokeDasharray="3 3" strokeWidth={2}>
           <text x="10" y="-5" fill="var(--accent-green)" fontSize={10} fontFamily="var(--font-label)">Target: 99%</text>
        </ReferenceLine>

        <Bar 
          yAxisId="right" 
          dataKey="discrepancyCount" 
          animationDuration={1000}
          label={(props: any) => <CustomizedLabel {...props} data={data} />}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.accuracy < 99 ? 'var(--accent-red)' : 'var(--accent-amber)'} 
              fillOpacity={entry.accuracy < 99 ? 0.8 : 0.6}
            />
          ))}
        </Bar>

        {/* Instead of a complex split gradient, we'll color the dots red if it falls below target */}
        <Line 
          yAxisId="left" 
          type="monotone" 
          dataKey="accuracy" 
          stroke="var(--accent-teal)" 
          strokeWidth={2}
          animationDuration={1500}
          dot={(props: any) => {
            const { cx, cy, payload, index, key } = props;
            const isFailing = payload.accuracy < 99;
            return (
              <circle 
                key={key || `dot-${index}`}
                cx={cx} 
                cy={cy} 
                r={4} 
                fill={isFailing ? 'var(--accent-red)' : 'var(--bg-base)'} 
                stroke={isFailing ? 'var(--accent-red)' : 'var(--accent-teal)'} 
                strokeWidth={2} 
              />
            );
          }}
          activeDot={{ r: 6, fill: 'var(--accent-teal)' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
