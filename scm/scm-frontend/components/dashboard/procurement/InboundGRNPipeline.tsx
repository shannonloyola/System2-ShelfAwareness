"use client";

import { useDashboardStore } from '@/store/dashboardStore';
import { useState, useEffect } from 'react';

const formatPHP = (val: number) => {
  if (val >= 1000000) return `₱${(val / 1000000).toFixed(1)}M`;
  return `₱${(val / 1000).toFixed(0)}k`;
};

// Generate Mock Data for Kanban
const generatePipelineData = () => {
  const stages = [
    { id: 'ordered', label: 'PO Ordered', icon: '', throughput: '↓ 45/week avg' },
    { id: 'confirmed', label: 'Supplier Confirmed', icon: '', throughput: '↓ 42/week avg' },
    { id: 'shipped', label: 'In Transit', icon: '', throughput: '↓ 38/week avg' },
    { id: 'arrived', label: 'Arrived/Receiving', icon: '', throughput: '↓ 35/week avg' },
    { id: 'qc', label: 'QC Inspection', icon: '', throughput: '↓ 30/week avg', isBottleneck: true },
    { id: 'completed', label: 'GRN Complete', icon: '', throughput: '↓ 28/week avg' },
  ];

  const suppliers = ['MedLine Philippines', 'PharmaDist Inc', 'GlobalMed Supply', 'BioTech Imports', 'CarePlus Logic'];
  const skus = ['MED-042', 'MED-115', 'MED-087', 'MED-003', 'MED-221'];
  const priorities = ['normal', 'normal', 'normal', 'urgent', 'critical'];

  return stages.map((stage, idx) => {
    // Bottleneck has higher days and more items
    const numItems = stage.isBottleneck ? 18 : Math.floor(Math.random() * 8) + 4;
    const items = [];
    let stageTotalValue = 0;

    let totalDays = 0;

    for (let i = 0; i < numItems; i++) {
      const isBad = stage.isBottleneck && Math.random() > 0.5;
      const days = isBad ? Math.floor(Math.random() * 10) + 8 : Math.floor(Math.random() * 5);
      const val = Math.floor(Math.random() * 500000) + 50000;
      stageTotalValue += val;
      totalDays += days;

      items.push({
        poNumber: `PO-2026-${Math.floor(Math.random() * 8000) + 1000}`,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
        sku: skus[Math.floor(Math.random() * skus.length)],
        qty: Math.floor(Math.random() * 1000) + 50,
        value: val,
        daysInStage: days,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
      });
    }

    // Sort items by priority (critical first) then days (oldest first)
    items.sort((a, b) => {
      const pMap: any = { critical: 3, urgent: 2, normal: 1 };
      if (pMap[b.priority] !== pMap[a.priority]) return pMap[b.priority] - pMap[a.priority];
      return b.daysInStage - a.daysInStage;
    });

    return {
      ...stage,
      count: numItems,
      value: stageTotalValue,
      avgDaysInStage: (totalDays / numItems) || 0,
      items
    };
  });
};

const MOCK_PIPELINE = generatePipelineData();

export default function InboundGRNPipeline() {
  const [mounted, setMounted] = useState(false);
  const setFilter = useDashboardStore(state => state.setFilter);
  const activeSupplier = useDashboardStore(state => state.filters.supplier);
  const activeSku = useDashboardStore(state => state.filters.sku);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isExpanded = useDashboardStore(state => state.expandedPanel === 'Inbound GRN Status Pipeline');

  return (
    <div className="flex w-full h-full pt-2 min-h-0 overflow-hidden">
      <style>{`
        @keyframes pulse-amber-border {
          0% { border-left-color: rgba(245, 158, 11, 1); box-shadow: -4px 0 8px rgba(245, 158, 11, 0.2); }
          50% { border-left-color: rgba(245, 158, 11, 0.4); box-shadow: none; }
          100% { border-left-color: rgba(245, 158, 11, 1); box-shadow: -4px 0 8px rgba(245, 158, 11, 0.2); }
        }
        @keyframes pulse-red-border {
          0% { border-left-color: rgba(239, 68, 68, 1); box-shadow: -4px 0 8px rgba(239, 68, 68, 0.3); }
          50% { border-left-color: rgba(239, 68, 68, 0.4); box-shadow: none; }
          100% { border-left-color: rgba(239, 68, 68, 1); box-shadow: -4px 0 8px rgba(239, 68, 68, 0.3); }
        }
      `}</style>
      <div 
        className="flex flex-row snap-x custom-scrollbar flex-1 grn-pipeline"
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '8px'
        }}
      >
        {MOCK_PIPELINE.map((stage, sIdx) => (
          <div
            key={stage.id}
            className="flex flex-col snap-start relative transition-all"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateX(0)' : 'translateX(20px)',
              transitionDelay: `${sIdx * 100}ms`,
              minWidth: '160px',
              flexShrink: 0,
              width: isExpanded ? '280px' : '180px',
              height: '100%',
              marginRight: '8px'
            }}
          >
            {/* Column Header */}
            <div
              className={`flex flex-col gap-1.5 rounded-t-lg border-b-2 relative ${isExpanded ? 'p-[12px_16px]' : 'p-[10px_12px]'}`}
              style={{
                backgroundColor: stage.isBottleneck ? 'rgba(245,158,11,0.05)' : 'var(--bg-elevated)',
                borderColor: stage.isBottleneck ? 'var(--accent-amber)' : 'var(--border-subtle)'
              }}
            >
              {stage.isBottleneck && (
                <div
                  className="absolute -top-3 right-2 bg-[var(--accent-amber)] text-black font-bold rounded shadow-lg animate-pulse"
                  style={{ fontSize: '8px', padding: '3px 6px' }}
                >
                  ⚠ BOTTLENECK
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`font-bold uppercase truncate ${isExpanded ? 'text-[12px]' : 'text-[10px]'}`} style={{ color: 'var(--text-primary)' }}>{stage.label}</span>
                </div>
                <div
                  className="bg-[var(--accent-teal)] text-white font-bold rounded-full font-mono flex items-center justify-center"
                  style={{ width: '18px', height: '18px', fontSize: '9px' }}
                >
                  {stage.count}
                </div>
              </div>

              <div className="flex items-center justify-between font-mono" style={{ fontSize: isExpanded ? '11px' : '9px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{formatPHP(stage.value)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{stage.throughput}</span>
              </div>
            </div>

            {/* Column Body (Scrollable) */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar p-1 mt-2">
              {stage.items.slice(0, 5).map((item, i) => {
                const isFaded = (activeSupplier && activeSupplier !== item.supplier) || (activeSku && activeSku !== item.sku);

                let borderStyle = '3px solid var(--border-subtle)';
                let animation = 'none';

                if (item.priority === 'critical') borderStyle = '3px solid var(--accent-red)';
                else if (item.priority === 'urgent') borderStyle = '3px solid var(--accent-amber)';

                if (item.daysInStage > 14) animation = 'pulse-red-border 2s infinite';
                else if (item.daysInStage > 7) animation = 'pulse-amber-border 2s infinite';

                return (
                  <div
                    key={`${item.poNumber}-${i}`}
                    onClick={() => {
                      // Toggle filtering for both supplier and SKU
                      setFilter('supplier', activeSupplier === item.supplier ? null : item.supplier);
                      setFilter('sku', activeSku === item.sku ? null : item.sku);
                    }}
                    className="flex flex-col cursor-pointer transition-all hover:opacity-85 relative bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                    style={{
                      opacity: isFaded ? 0.3 : 1,
                      borderLeft: borderStyle,
                      animation: animation,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      marginBottom: '4px'
                    }}
                  >
                    {/* Priority Dot */}
                    {item.priority !== 'normal' && (
                      <div
                        className="absolute top-2 right-2 rounded-full"
                        style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: item.priority === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)'
                        }}
                      />
                    )}

                    {/* Top Row: PO Number and Days waiting */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold font-mono" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{item.poNumber}</span>
                      <span
                        className="font-bold text-[9px] px-1.5 py-0.5 rounded font-mono"
                        style={{ backgroundColor: 'var(--bg-base)', color: item.daysInStage > 7 ? (item.daysInStage > 14 ? 'var(--accent-red)' : 'var(--accent-amber)') : 'var(--accent-green)' }}
                      >
                        {item.daysInStage}d waiting
                      </span>
                    </div>

                    {/* Middle Row: Supplier (takes up full width) */}
                    <div className="text-[10px] truncate w-full mb-1" style={{ color: 'var(--text-secondary)' }} title={item.supplier}>
                      {item.supplier}
                    </div>

                    {/* Bottom Row: SKU, Qty, Value */}
                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[var(--border-subtle)]/40 font-mono text-[9px]">
                      <span className="font-bold px-1 rounded" style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-base)' }}>
                        {item.sku}
                      </span>
                      <div className="flex gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span>{item.qty} u</span>
                        <span>•</span>
                        <span className="font-bold">{formatPHP(item.value)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Column Footer */}
              {stage.count > 5 && (
                <div className="text-center py-1 mt-1 cursor-pointer hover:underline text-[10px] font-bold" style={{ color: 'var(--accent-teal)' }}>
                  + {stage.count - 5} more POs
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
