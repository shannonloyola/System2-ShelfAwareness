"use client";

import { ReactNode } from "react";
import { Info, Maximize2, AlertCircle, BarChart2 } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { FullscreenModal } from "./shared/FullscreenModal";
import { ErrorBoundary } from "./shared/ErrorBoundary";

interface PanelWrapperProps {
  title: string;
  children: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  hasAnomaly?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  filterActive?: boolean;
  chartType?: 'line' | 'bar' | 'gauge' | 'kanban' | 'mixed' | 'table';
  infoTooltip?: string;
  style?: React.CSSProperties;
  contentOverflow?: "auto" | "hidden" | "visible";
}

const ShimmerSkeleton = ({ type }: { type?: string }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)] z-10 p-4">
      <div className="w-full h-full relative overflow-hidden flex items-end justify-center gap-2">
        {/* Shimmer animation base */}
        <style>{`
          @keyframes shimmer-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          .shimmer-gradient {
            background: linear-gradient(90deg, transparent, rgba(0, 163, 173, 0.1), transparent);
            animation: shimmer-sweep 2s infinite;
          }
        `}</style>
        
        {/* Type specific shapes */}
        {type === 'bar' && (
          <>
            {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
              <div key={i} className="w-8 rounded-t bg-[var(--border)]" style={{ height: `${h}%` }} />
            ))}
          </>
        )}
        
        {type === 'gauge' && (
          <div className="w-48 h-24 bg-[var(--border)] rounded-t-full mb-10" />
        )}
        
        {type === 'line' && (
          <svg width="100%" height="100%" preserveAspectRatio="none" className="opacity-50">
            <path d="M0,100 Q50,20 100,80 T200,50 T300,120 T400,40" fill="none" stroke="var(--border)" strokeWidth="4" />
          </svg>
        )}

        {(!type || type === 'mixed' || type === 'table' || type === 'kanban') && (
          <div className="w-full h-full flex flex-col gap-3">
            <div className="h-6 w-1/3 rounded bg-[var(--border)]" />
            <div className="flex-1 rounded bg-[var(--border)]" />
          </div>
        )}

        {/* Shimmer Overlay */}
        <div className="absolute inset-0 shimmer-gradient" />
      </div>
    </div>
  );
};

export default function PanelWrapper({
  title,
  children,
  isLoading,
  isEmpty,
  hasAnomaly,
  error,
  onRetry,
  className = "",
  filterActive = false,
  chartType,
  infoTooltip,
  style,
  contentOverflow = "auto",
}: PanelWrapperProps) {
  const setExpandedPanel = useDashboardStore(state => state.setExpandedPanel);

  return (
    <div 
      data-panel-title={title}
      className={`panel-wrapper relative ${className}`}
      style={{ 
        borderRadius: '10px',
        border: filterActive ? '1px solid var(--accent-teal)' : '1px solid var(--border)',
        background: 'var(--bg-surface)',
        boxShadow: filterActive ? '0 0 15px rgba(0, 163, 173, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'border-color 200ms ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style
      }}
      onMouseEnter={(e) => {
        if (!filterActive) e.currentTarget.style.borderColor = 'var(--accent-teal)';
      }}
      onMouseLeave={(e) => {
        if (!filterActive) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Panel Header */}
      <div 
        className="flex-shrink-0" 
        style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid var(--border)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] uppercase relative" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
            {title}
            {hasAnomaly && (
              <div className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-[var(--accent-red)]" title="Anomaly detected in this panel" />
            )}
          </h3>
          
          {!error && (
            <span
              className="inline-flex"
              title={filterActive ? "Filter not applicable to this panel" : (infoTooltip || title)}
            >
              <Info
                className="w-3.5 h-3.5 cursor-help opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={filterActive ? "Filter not applicable to this panel" : (infoTooltip || title)}
              />
            </span>
          )}
          
          {filterActive && (
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-teal)' }} title="Filter Active" />
          )}
        </div>
        <button 
          onClick={() => setExpandedPanel(title)}
          className="flex items-center justify-center cursor-pointer"
          style={{
            width: '24px',
            height: '24px',
            color: 'var(--text-secondary)',
            transition: 'color 150ms',
            border: 'none',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#00A3AD'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Panel Content Area */}
      <div 
        className="relative flex-1 flex flex-col w-full h-full"
        style={{
          padding: '8px',
          flex: '1',
          overflow: contentOverflow,
          minHeight: '0'
        }}
      >
        {isLoading ? (
          <ShimmerSkeleton type={chartType} />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 p-4 text-center bg-[var(--bg-base)]">
            <AlertCircle className="w-8 h-8 text-[var(--accent-amber)] mb-2" />
            <p className="text-[14px] font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>Failed to load data</p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="mt-2 px-4 py-1.5 rounded text-[11px] font-bold transition-colors hover:bg-[rgba(0,163,173,0.1)] border border-[var(--accent-teal)] text-[var(--accent-teal)] uppercase tracking-wider"
              >
                ↻ Retry
              </button>
            )}
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10 p-4 text-center bg-[var(--bg-surface)]">
            <BarChart2 className="w-8 h-8 opacity-30 mb-2" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-[14px] font-bold" style={{ color: 'var(--text-secondary)' }}>No data for selected period</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Try adjusting the date range or filters</p>
          </div>
        ) : (
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        )}
      </div>

      {/* Modal is rendered here to inherit context, but fixed position breaks it out of the overflow: hidden */}
      <FullscreenModal title={title} panelId={title}>
        {children}
      </FullscreenModal>
    </div>
  );
}
