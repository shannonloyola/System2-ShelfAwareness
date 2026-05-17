"use client";

import { useMemo } from 'react';
import {
  ComposedChart,
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
  { name: 'Total Budget',     value: 8000000,  type: 'total' },
  { name: 'Antibiotics',      value: -1850000, type: 'spend' },
  { name: 'Surgical',         value: -1200000, type: 'spend' },
  { name: 'Diagnostics',      value: -980000,  type: 'spend' },
  { name: 'Vaccines',         value: -760000,  type: 'spend' },
  { name: 'Equipment',        value: -540000,  type: 'spend' },
  { name: 'Remaining',        value: 2670000,  type: 'remaining' },
];

const formatPHP = (val: number) => `₱${(Math.abs(val) / 1000000).toFixed(1)}M`;

// Transform data for waterfall chart rendering (start and end array for Bar)
const prepareWaterfallData = (data: any[]) => {
  let currentTotal = 0;
  return data.map((item, index) => {
    let start = 0;
    let end = 0;

    if (item.type === 'total') {
      start = 0;
      end = item.value;
      currentTotal = item.value;
    } else if (item.type === 'spend') {
      start = currentTotal;
      end = currentTotal + item.value; // value is negative
      currentTotal = end;
    } else if (item.type === 'remaining') {
      start = 0;
      end = item.value;
    }

    return {
      ...item,
      waterfallRange: [start, end],
      displayValue: item.value
    };
  });
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 border rounded shadow-lg" style={{ backgroundColor: '#1A3A5C', borderColor: 'var(--border-subtle)' }}>
        <p className="text-[11px] mb-1 font-bold" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>{data.name}</p>
        <p className="text-[14px] font-bold" style={{ color: data.type === 'spend' ? 'var(--accent-amber)' : data.type === 'remaining' ? 'var(--accent-green)' : 'var(--accent-teal)', fontFamily: 'var(--font-data)' }}>
          {data.displayValue > 0 && data.type !== 'total' && data.type !== 'remaining' ? '+' : ''}
          ₱{data.displayValue.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// Custom shape to draw the connector lines and labels
const WaterfallBar = (props: any) => {
  const { x, y, width, height, payload, index, data } = props;
  const isSpend = payload.type === 'spend';
  const color = payload.type === 'total' ? 'var(--accent-teal)' : payload.type === 'spend' ? 'rgba(245, 158, 11, 0.8)' : 'var(--accent-green)';
  
  const yPos = isSpend ? y : y;
  
  // Find previous item's end Y to draw connector line
  let prevY = null;
  if (index > 0 && index < data.length - 1) {
    // We approximate the connection line Y coordinate based on current element.
    // In Recharts, y is always the top of the bar. 
    // If it's a spend bar, it goes DOWN, meaning its top (y) is its START value.
    // So the line should just go straight left from its top.
    prevY = yPos;
  }

  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={color} rx={2} />
      {/* Connector Line */}
      {index > 0 && payload.type !== 'remaining' && (
        <line 
          x1={x - (width * 0.7)} // arbitrary distance to previous bar
          y1={yPos} 
          x2={x} 
          y2={yPos} 
          stroke="var(--text-secondary)" 
          strokeDasharray="2 2" 
          strokeWidth={1}
        />
      )}
      {/* Label */}
      <text 
        x={x + width / 2} 
        y={y - 8} 
        fill="var(--text-secondary)" 
        textAnchor="middle" 
        fontSize={9} 
        fontFamily="var(--font-data)"
        fontWeight="bold"
      >
        {formatPHP(payload.displayValue)}
      </text>
    </g>
  );
};

export default function BudgetWaterfall() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeCategoryFilter = useDashboardStore((state) => state.filters.category);
  
  const data = useMemo(() => prepareWaterfallData(MOCK_DATA), []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{ top: 20, right: 10, left: -20, bottom: 40 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border-subtle)' }}
          angle={-35}
          textAnchor="end"
          height={45}
          interval={0}
        />
        <YAxis 
          tickFormatter={formatPHP}
          tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<CustomTooltip />} />
        <Bar 
          dataKey="waterfallRange" 
          animationDuration={1200}
          shape={(props: any) => <WaterfallBar {...props} data={data} />}
          onClick={(e: any) => {
            if (e && e.type === 'spend' && e.name) {
               setFilter('category', activeCategoryFilter === e.name ? null : e.name);
            }
          }}
          className="cursor-pointer"
        >
          {data.map((entry, index) => (
             <Cell 
               key={`cell-${index}`} 
               opacity={(activeCategoryFilter && activeCategoryFilter !== entry.name && entry.type === 'spend') ? 0.2 : 1}
             />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
