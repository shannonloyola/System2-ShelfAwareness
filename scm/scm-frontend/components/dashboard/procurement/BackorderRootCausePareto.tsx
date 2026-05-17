"use client";

import { useDashboardStore } from '@/store/dashboardStore';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

const MOCK_DATA = [
  { sku: 'MED-042', name: 'Insulin Glargine', supplier: 'MedLine Philippines', backorderCount: 34, cumulativePct: 18.3 },
  { sku: 'MED-115', name: 'Meropenem 1g', supplier: 'PharmaDist Inc', backorderCount: 28, cumulativePct: 33.3 },
  { sku: 'MED-087', name: 'Atorvastatin 40mg', supplier: 'GlobalMed Supply', backorderCount: 22, cumulativePct: 45.2 },
  { sku: 'MED-003', name: 'Amoxicillin 500mg', supplier: 'MedLine Philippines', backorderCount: 19, cumulativePct: 55.4 },
  { sku: 'MED-221', name: 'Metformin 500mg', supplier: 'GlobalMed Supply', backorderCount: 16, cumulativePct: 64.0 },
  { sku: 'MED-156', name: 'Propofol 10mg', supplier: 'PharmaDist Inc', backorderCount: 14, cumulativePct: 71.5 },
  { sku: 'MED-089', name: 'Clopidogrel 75mg', supplier: 'GlobalMed Supply', backorderCount: 11, cumulativePct: 77.4 },
  { sku: 'MED-334', name: 'Pantoprazole 40mg', supplier: 'CarePlus Logic', backorderCount: 9, cumulativePct: 82.3 },
  { sku: 'MED-011', name: 'Ceftriaxone 1g', supplier: 'MedLine Philippines', backorderCount: 7, cumulativePct: 86.1 },
  { sku: 'MED-112', name: 'Levothyroxine 50mcg', supplier: 'PharmaDist Inc', backorderCount: 6, cumulativePct: 89.2 },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 border rounded shadow-lg min-w-[200px] z-50" style={{ backgroundColor: '#1A3A5C', borderColor: 'var(--border-subtle)' }}>
        <p className="text-[12px] font-bold text-white mb-1">{data.name}</p>
        <p className="text-[10px] font-mono mb-3" style={{ color: 'var(--text-secondary)' }}>{data.sku} | {data.supplier}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Backorders</span>
            <span className="font-bold" style={{ color: 'var(--accent-red)' }}>{data.backorderCount}</span>
          </div>
          <div className="flex flex-col">
            <span style={{ color: 'var(--text-secondary)' }}>Cumulative</span>
            <span className="font-bold" style={{ color: 'var(--accent-teal)' }}>{data.cumulativePct}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom X-Axis tick
const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const item = MOCK_DATA.find(d => d.name === payload.value || d.sku === payload.value);
  if (!item) return null;

  const abbrev = item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={10} textAnchor="middle" fill="var(--text-secondary)" fontSize={9} fontFamily="var(--font-label)" fontWeight="bold">
        {abbrev}
      </text>
      <text x={0} y={22} textAnchor="middle" fill="var(--text-secondary)" opacity={0.7} fontSize={8} fontFamily="var(--font-data)">
        {item.sku}
      </text>
    </g>
  );
};

export default function BackorderRootCausePareto() {
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeSku = useDashboardStore(state => state.filters.sku);
  const activeSupplier = useDashboardStore(state => state.filters.supplier);

  const filteredData = MOCK_DATA.map(d => ({
    ...d,
    isFaded: (activeSku && activeSku !== d.sku) || (activeSupplier && activeSupplier !== d.supplier)
  }));

  // Identify where the 80% cutoff happens for the separator
  // The first item > 80% is index 7
  const cutoffIndex = 6.5; 

  return (
    <div className="flex flex-col h-full w-full justify-between pb-1">
      <div className="relative flex-1 min-h-0 pt-2">
        {/* Callout Annotation */}
        <div className="absolute top-2 right-4 z-10 px-2 py-1 rounded bg-[rgba(0,163,173,0.1)] border border-[var(--accent-teal)]">
          <span className="text-[10px] font-bold" style={{ color: 'var(--accent-teal)', fontFamily: 'var(--font-label)' }}>
            7 SKUs cause 80% of backorders
          </span>
        </div>

        {/* Region Labels */}
        <div className="absolute top-8 left-16 z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-label)' }}>
            Vital Few (80%)
          </span>
        </div>
        <div className="absolute top-8 right-[25%] z-10">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
            Trivial Many
          </span>
        </div>

        <div className="w-full h-full min-h-0 mt-6 pb-2">
          <ResponsiveContainer width="100%" height="90%">
            <ComposedChart
              data={filteredData}
              margin={{ top: 20, right: 10, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={<CustomXAxisTick />}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                interval={0}
              />
              {/* Left Y-Axis for Count */}
              <YAxis 
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
                tickLine={false}
                axisLine={false}
              />
              {/* Right Y-Axis for Cumulative % */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}
                tickLine={false}
                axisLine={false}
              />
              
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              
              <ReferenceLine yAxisId="right" y={80} stroke="var(--accent-amber)" strokeDasharray="3 3" strokeWidth={1.5}>
                <text x="10" y="-5" fill="var(--accent-amber)" fontSize={9} fontFamily="var(--font-label)" fontWeight="bold">80% Threshold</text>
              </ReferenceLine>

              {/* Vertical Separator */}
              <ReferenceLine x={MOCK_DATA[7].name} yAxisId="left" stroke="var(--text-secondary)" strokeDasharray="5 5" strokeWidth={1} />

              <Bar 
                yAxisId="left" 
                dataKey="backorderCount" 
                animationDuration={1000}
                onClick={(e: any) => {
                  if (e && e.sku) setFilter('sku', activeSku === e.sku ? null : e.sku);
                }}
                className="cursor-pointer"
              >
                {filteredData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index < 7 ? 'var(--accent-red)' : 'var(--text-secondary)'} 
                    opacity={entry.isFaded ? 0.2 : 0.9}
                  />
                ))}
              </Bar>

              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="cumulativePct" 
                stroke="var(--accent-teal)" 
                strokeWidth={2}
                animationDuration={1500}
                dot={{ r: 3, fill: 'var(--bg-base)', stroke: 'var(--accent-teal)', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: 'var(--accent-teal)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prescriptive Pareto Footer Bar */}
      <div 
        className="p-2 px-3 rounded flex flex-col border-t mt-1 shrink-0" 
        style={{ 
          backgroundColor: 'rgba(245, 158, 11, 0.04)', 
          borderColor: 'rgba(245, 158, 11, 0.2)',
          borderLeft: '3.5px solid var(--accent-amber)'
        }}
      >
        <span className="text-[11px] font-bold" style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-label)' }}>
          ⚡ 7 SKUs causing 80% of backorders — chronic pattern detected for 4+ weeks
        </span>
        <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-label)' }}>
          → Recommended: Review safety stock levels for Insulin Glargine, Meropenem, Atorvastatin
        </span>
      </div>
    </div>
  );
}
