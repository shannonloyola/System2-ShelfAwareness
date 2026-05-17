"use client";

import { useState, useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

type EventType = 'TRANSFER' | 'ADJUSTMENT' | 'RECEIVING' | 'DISPATCH' | 'CYCLE_COUNT';
type Severity = 'info' | 'warning' | 'critical';

interface MovementEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  severity: Severity;
  sku: string;
  productName: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  unit: string;
  triggeredBy: string;
  status: string;
}

const generateMockEvents = (count: number): MovementEvent[] => {
  const events: MovementEvent[] = [];
  const types: EventType[] = ['TRANSFER', 'ADJUSTMENT', 'RECEIVING', 'DISPATCH', 'CYCLE_COUNT'];
  const severities: Severity[] = ['info', 'warning', 'critical'];
  const products = [
    { sku: 'MED-042', name: 'Insulin Glargine 100U/mL' },
    { sku: 'MED-119', name: 'Meropenem 1g Injection' },
    { sku: 'MED-087', name: 'Atorvastatin 40mg' },
    { sku: 'MED-003', name: 'Metformin 500mg' }
  ];
  const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const from = `${zones[Math.floor(Math.random() * zones.length)]} - Aisle ${Math.floor(Math.random() * 6) + 1}`;
    const to = `${zones[Math.floor(Math.random() * zones.length)]} - Aisle ${Math.floor(Math.random() * 6) + 1}`;
    
    events.push({
      id: `EVT-${Math.floor(Math.random() * 100000)}`,
      timestamp: new Date(Date.now() - i * 60000 * (Math.random() * 10)),
      type,
      severity: Math.random() > 0.8 ? 'critical' : Math.random() > 0.5 ? 'warning' : 'info',
      sku: product.sku,
      productName: product.name,
      fromLocation: type === 'RECEIVING' ? 'Dock 1' : from,
      toLocation: type === 'DISPATCH' ? 'Loading Bay' : to,
      quantity: (Math.floor(Math.random() * 100) + 1) * ((type === 'DISPATCH' || type === 'ADJUSTMENT') && Math.random() > 0.5 ? -1 : 1),
      unit: 'vials',
      triggeredBy: 'Juan dela Cruz',
      status: Math.random() > 0.9 ? 'pending' : 'completed'
    });
  }
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const getTypeColor = (type: EventType) => {
  switch (type) {
    case 'TRANSFER': return { bg: 'rgba(0,163,173,0.2)', text: 'var(--accent-teal)' };
    case 'ADJUSTMENT': return { bg: 'rgba(245,158,11,0.2)', text: 'var(--accent-amber)' };
    case 'RECEIVING': return { bg: 'rgba(16,185,129,0.2)', text: 'var(--accent-green)' };
    case 'DISPATCH': return { bg: 'rgba(59,130,246,0.2)', text: '#3B82F6' };
    case 'CYCLE_COUNT': return { bg: 'rgba(168,85,247,0.2)', text: '#A855F7' };
  }
};

const getSeverityColor = (sev: Severity) => {
  if (sev === 'critical') return 'var(--accent-red)';
  if (sev === 'warning') return 'var(--accent-amber)';
  return 'var(--accent-green)';
};

const relativeTime = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const ITEMS_PER_PAGE = 8;

export default function LiveStockMovementFeed() {
  const [events, setEvents] = useState<MovementEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [newEventsCount, setNewEventsCount] = useState(0);
  
  const setGlobalFilter = useDashboardStore(state => state.setFilter);
  const activeSku = useDashboardStore(state => state.filters.sku);
  const activeZone = useDashboardStore(state => state.filters.zone);
  
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    setEvents(generateMockEvents(50));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => {
        const newEvent = generateMockEvents(1)[0];
        newEvent.timestamp = new Date();
        return [newEvent, ...prev]; // Grow the list
      });
      setTicker(t => t + 1);
      
      // If we are not on page 1, increment unseen count
      if (currentPage > 1) {
        setNewEventsCount(prev => prev + 1);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [currentPage]);

  // Tick every minute to update "m ago" labels
  useEffect(() => {
    const timer = setInterval(() => setTicker(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // When changing to page 1 manually, reset unread count
  useEffect(() => {
    if (currentPage === 1) {
      setNewEventsCount(0);
    }
  }, [currentPage]);

  const filteredEvents = events.filter(e => {
    if (activeFilter !== 'ALL' && e.type !== activeFilter) return false;
    if (activeZone && !e.fromLocation.includes(activeZone) && !e.toLocation.includes(activeZone)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));
  const currentEvents = filteredEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-surface)] relative" style={{ maxHeight: '100%' }}>
      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 hide-scrollbar px-1">
        {['ALL', 'TRANSFER', 'ADJUSTMENT', 'RECEIVING', 'DISPATCH'].map(f => (
          <button
            key={f}
            onClick={() => {
              setActiveFilter(f);
              setCurrentPage(1);
            }}
            className={`px-3 py-1 text-[10px] font-bold rounded-full border transition-colors shrink-0`}
            style={{
              backgroundColor: activeFilter === f ? 'var(--accent-teal)' : 'transparent',
              color: activeFilter === f ? '#fff' : 'var(--text-secondary)',
              borderColor: activeFilter === f ? 'var(--accent-teal)' : 'var(--border-subtle)',
              fontFamily: 'var(--font-label)'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List Area */}
      <div 
        className="flex-1 flex flex-col gap-1.5 relative panel-body custom-scrollbar"
        style={{
          overflowY: 'auto',
          maxHeight: '100%'
        }}
      >
        {newEventsCount > 0 && currentPage > 1 && (
          <div 
            className="absolute top-0 left-0 right-0 z-10 flex justify-center mt-1"
          >
            <button 
              onClick={() => setCurrentPage(1)}
              className="bg-[var(--accent-teal)] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              {newEventsCount} new event{newEventsCount > 1 ? 's' : ''}
            </button>
          </div>
        )}

        {currentEvents.map((evt, idx) => {
          const typeStyle = getTypeColor(evt.type);
          const isCritical = evt.severity === 'critical';
          const isFaded = activeSku && activeSku !== evt.sku;
          
          return (
            <div 
              key={evt.id}
              onClick={() => setGlobalFilter('sku', activeSku === evt.sku ? null : evt.sku)}
              className="flex items-center gap-3 p-2 rounded border cursor-pointer hover:scale-[1.01] transition-all overflow-hidden relative shrink-0"
              style={{
                borderColor: isCritical ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)',
                backgroundColor: isCritical ? 'rgba(239,68,68,0.05)' : 'var(--bg-elevated)',
                opacity: isFaded ? 0.3 : 1,
                animation: (currentPage === 1 && idx === 0) ? 'slideDown 400ms ease-out' : 'none',
                height: '38px' // Fixed height per row to fit perfectly
              }}
            >
              {isCritical && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}

              {/* Left Column */}
              <div className="w-[80px] shrink-0 flex flex-col gap-0.5 pl-1">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: getSeverityColor(evt.severity) }} />
                  <span 
                    className="text-[7px] font-bold uppercase tracking-wider px-1 rounded leading-tight"
                    style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
                  >
                    {evt.type}
                  </span>
                </div>
                <span className="text-[8px] font-mono" style={{ color: 'var(--text-secondary)' }}>{evt.id}</span>
              </div>

              {/* Center Column */}
              <div className="flex-1 flex flex-col min-w-0 justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>{evt.productName}</span>
                  <span className="text-[9px] font-mono" style={{ color: 'var(--text-secondary)' }}>{evt.sku}</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] truncate mt-0.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }}>
                  <span className="truncate max-w-[80px]">{evt.fromLocation}</span>
                  <ArrowRight className="w-2.5 h-2.5 shrink-0 opacity-50" />
                  <span className="truncate max-w-[80px]">{evt.toLocation}</span>
                </div>
              </div>

              {/* Right Column */}
              <div className="w-[60px] shrink-0 flex flex-col items-end gap-0.5 text-right justify-center">
                <span className="text-[12px] font-bold font-mono leading-none" style={{ color: evt.quantity > 0 ? 'var(--accent-green)' : evt.quantity < 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                  {evt.quantity > 0 ? '+' : ''}{evt.quantity}
                </span>
                <span className="text-[8px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-data)' }}>{relativeTime(evt.timestamp)}</span>
              </div>
            </div>
          );
        })}

        <style>{`
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-dot {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>

      {/* Pagination Footer */}
      <div className="mt-auto pt-2 border-t flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-[11px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length} events
        </span>
        
        <div className="flex items-center gap-1">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="p-1 rounded transition-colors disabled:opacity-30 hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Simple page numbers */}
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            // Logic to show a small window of pages
            let pageNum = currentPage;
            if (currentPage <= 3) pageNum = i + 1;
            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = currentPage - 2 + i;
            
            if (pageNum < 1 || pageNum > totalPages) return null;
            
            const isActive = currentPage === pageNum;
            
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold transition-colors font-mono"
                style={{
                  backgroundColor: isActive ? 'var(--accent-teal)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)'
                }}
              >
                {pageNum}
              </button>
            );
          })}

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="p-1 rounded transition-colors disabled:opacity-30 hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)]">
          <span className="text-[10px] font-bold text-[var(--accent-green)] font-mono tracking-wider">LIVE</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" style={{ animation: 'pulse-dot 1.5s infinite' }} />
        </div>
      </div>
    </div>
  );
}
