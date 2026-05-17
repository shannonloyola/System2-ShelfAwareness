"use client";

import { useDashboardStore } from '@/store/dashboardStore';
import { useEffect, useState } from 'react';

const MOCK_DATA = [
  { rank: 1, sku: 'MED-042', name: 'Insulin Glargine 100U/mL', category: 'Endocrinology', exposure: 2840000, trend: [2100000, 2300000, 2500000, 2650000, 2840000], stockLevel: 120, status: 'warning' },
  { rank: 2, sku: 'MED-119', name: 'Meropenem 1g Injection', category: 'Antibiotics', exposure: 1950000, trend: [2000000, 1980000, 1850000, 1900000, 1950000], stockLevel: 45, status: 'critical' },
  { rank: 3, sku: 'MED-087', name: 'Atorvastatin 40mg', category: 'Cardiology', exposure: 1420000, trend: [1100000, 1200000, 1250000, 1300000, 1420000], stockLevel: 450, status: 'healthy' },
  { rank: 4, sku: 'MED-003', name: 'Metformin 500mg', category: 'Endocrinology', exposure: 1250000, trend: [1100000, 1150000, 1200000, 1220000, 1250000], stockLevel: 80, status: 'warning' },
  { rank: 5, sku: 'MED-215', name: 'Propofol 10mg/mL', category: 'Anesthetics', exposure: 980000, trend: [750000, 800000, 850000, 910000, 980000], stockLevel: 25, status: 'critical' },
  { rank: 6, sku: 'MED-099', name: 'Clopidogrel 75mg', category: 'Cardiology', exposure: 850000, trend: [950000, 900000, 880000, 860000, 850000], stockLevel: 310, status: 'healthy' },
  { rank: 7, sku: 'MED-144', name: 'Pantoprazole 40mg IV', category: 'Gastroenterology', exposure: 760000, trend: [700000, 720000, 740000, 750000, 760000], stockLevel: 150, status: 'healthy' },
  { rank: 8, sku: 'MED-033', name: 'Ceftriaxone 1g IV', category: 'Antibiotics', exposure: 690000, trend: [710000, 700000, 680000, 685000, 690000], stockLevel: 65, status: 'warning' },
  { rank: 9, sku: 'MED-112', name: 'Levothyroxine 50mcg', category: 'Endocrinology', exposure: 540000, trend: [450000, 480000, 500000, 520000, 540000], stockLevel: 220, status: 'healthy' },
  { rank: 10, sku: 'MED-201', name: 'Bupivacaine 5mg/mL', category: 'Anesthetics', exposure: 450000, trend: [500000, 480000, 470000, 460000, 450000], stockLevel: 18, status: 'critical' },
];

const MAX_EXPOSURE = Math.max(...MOCK_DATA.map(d => d.exposure));

const getStatusColor = (status: string) => {
  if (status === 'critical') return 'var(--accent-red)';
  if (status === 'warning') return 'var(--accent-amber)';
  return 'var(--accent-green)';
};

const formatPHP = (val: number) => {
  if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `₱${(val / 1000).toFixed(0)}k`;
  return `₱${val}`;
};

// Raw SVG Sparkline
const Sparkline = ({ data }: { data: number[] }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const width = 72;
  const height = 28;
  const pad = 3; // 3px padding to prevent any boundary clipping
  
  const points = data.map((val, i) => {
    const x = pad + (i / (data.length - 1)) * (width - 2 * pad);
    const y = pad + (height - 2 * pad) - ((val - min) / range) * (height - 2 * pad);
    return `${x},${y}`;
  }).join(' ');

  const lastX = pad + (width - 2 * pad);
  const lastY = pad + (height - 2 * pad) - ((data[data.length - 1] - min) / range) * (height - 2 * pad);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline 
        points={points}
        fill="none"
        stroke="var(--accent-teal)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Circle on last point */}
      <circle 
        cx={lastX} 
        cy={lastY} 
        r="3" 
        fill="var(--accent-teal)" 
      />
    </svg>
  );
};

export default function TopExposureProducts() {
  const [mounted, setMounted] = useState(false);
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeSku = useDashboardStore(state => state.filters.sku);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col w-full h-full gap-1 overflow-y-auto pr-2 custom-scrollbar">
      {MOCK_DATA.map((item, index) => {
        const isFaded = activeSku && activeSku !== item.sku;
        const widthPercent = (item.exposure / MAX_EXPOSURE) * 100;
        
        return (
          <div 
            key={item.sku}
            onClick={() => setFilter('sku', activeSku === item.sku ? null : item.sku)}
            className="flex items-center gap-3 rounded-lg cursor-pointer transition-all duration-300 group"
            style={{ 
              padding: '8px 12px',
              opacity: isFaded ? 0.3 : 1,
              transform: mounted ? 'translateY(0)' : 'translateY(10px)',
              transitionDelay: `${index * 50}ms`,
            }}
          >
            {/* Hover Background - done via Tailwind classes but injected dynamically */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-50 rounded-lg pointer-events-none transition-opacity" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            
            {/* Rank & Status */}
            <div className="flex items-center gap-2 w-[40px] shrink-0">
              <div 
                className="flex items-center justify-center font-bold font-mono rounded" 
                style={{ width: '20px', height: '20px', fontSize: '10px', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                {item.rank}
              </div>
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: getStatusColor(item.status) }} 
              />
            </div>

            {/* Product Info */}
            <div className="flex flex-col w-[140px] shrink-0" style={{ minWidth: '0' }}>
              <span className="text-[12px] font-bold truncate block w-full" style={{ color: 'var(--text-primary)' }} title={item.name}>
                {item.name}
              </span>
              <div className="flex items-center gap-1.5 text-[9px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                <span>{item.sku}</span>
                <span className="w-0.5 h-0.5 rounded-full bg-current opacity-50" />
                <span className="truncate">{item.category}</span>
              </div>
            </div>

            {/* Exposure Bar */}
            <div className="flex-1 flex flex-col justify-center min-w-[100px]">
              <div className="w-full h-3 rounded-full flex items-center" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-1.5"
                  style={{ 
                    width: mounted ? `${widthPercent}%` : '0%', 
                    backgroundColor: getStatusColor(item.status) 
                  }}
                >
                  <span className="text-[9px] font-bold text-white font-mono drop-shadow-md">
                    {formatPHP(item.exposure)}
                  </span>
                </div>
              </div>
            </div>

            {/* Trend Sparkline */}
            <div className="shrink-0 w-[72px] flex justify-end">
              <Sparkline data={item.trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
