"use client";

import { useEffect, useState, useRef } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { X, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { createPortal } from "react-dom";

interface FullscreenModalProps {
  children: React.ReactNode;
  title: string;
  panelId: string;
}

export function FullscreenModal({ children, title, panelId }: FullscreenModalProps) {
  const expandedPanel = useDashboardStore(state => state.expandedPanel);
  const setExpandedPanel = useDashboardStore(state => state.setExpandedPanel);
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isActive = expandedPanel === panelId;

  useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  // Handle open/close animations
  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
      // Small delay to allow display:block before starting animation
      requestAnimationFrame(() => setIsAnimating(true));
      document.body.style.overflow = "hidden";
    } else if (isOpen) {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsOpen(false);
        if (!useDashboardStore.getState().expandedPanel) {
          document.body.style.overflow = "";
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isActive, isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        setExpandedPanel(null);
      }
    };
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, setExpandedPanel]);

  const handleExportPNG = async () => {
    if (!contentRef.current) return;
    
    // Add temporary watermark
    const watermark = document.createElement('div');
    watermark.innerHTML = `Shelf Awareness<br/>${new Date().toLocaleString()}`;
    watermark.style.position = 'absolute';
    watermark.style.bottom = '20px';
    watermark.style.right = '20px';
    watermark.style.opacity = '0.3';
    watermark.style.color = 'white';
    watermark.style.fontFamily = 'monospace';
    watermark.style.fontSize = '12px';
    watermark.style.textAlign = 'right';
    watermark.style.zIndex = '99';
    watermark.style.pointerEvents = 'none';
    
    contentRef.current.appendChild(watermark);

    try {
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: null,
        scale: 2, // High resolution
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `ShelfAwareness_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      watermark.remove();
    }
  };

  if (!isOpen || !portalContainer) return null;

  return createPortal(
    <div 
      className="fullscreen-modal flex items-center justify-center transition-all duration-200"
      style={{
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        position: 'fixed',
        inset: '0',
        opacity: isAnimating ? 1 : 0,
        pointerEvents: isAnimating ? 'auto' : 'none'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setExpandedPanel(null);
      }}
    >
      <div 
        ref={modalRef}
        className="flex flex-col bg-[var(--bg-elevated)] shadow-2xl transition-all duration-200"
        style={{
          width: '95vw',
          height: '90vh',
          padding: '0',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          transform: isAnimating ? 'scale(1)' : 'scale(0.95)'
        }}
      >
        {/* Header with visual separation and comfortable padding */}
        <div className="shrink-0 bg-[var(--bg-surface)]" style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="uppercase tracking-widest font-bold" style={{ fontSize: '15px', color: 'var(--text-primary)', fontFamily: 'var(--font-label)' }}>{title}</h2>
          <div className="flex items-center gap-4">
            {/* Outline Export Button */}
            <button 
              onClick={handleExportPNG}
              className="flex items-center gap-2 rounded-lg font-semibold transition-all cursor-pointer"
              style={{ 
                height: '36px', 
                padding: '0 16px', 
                fontSize: '12px',
                color: 'var(--accent-teal)', 
                border: '1px solid var(--accent-teal)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.backgroundColor = 'var(--accent-teal)'; 
                e.currentTarget.style.color = '#000000'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.backgroundColor = 'transparent'; 
                e.currentTarget.style.color = 'var(--accent-teal)'; 
              }}
            >
              <Download className="w-4 h-4" />
              <span>Export PNG</span>
            </button>
            {/* Premium Close Button */}
            <button 
              onClick={() => setExpandedPanel(null)}
              className="flex items-center justify-center rounded-lg border transition-colors cursor-pointer"
              style={{ 
                width: '36px', 
                height: '36px', 
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; 
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                e.currentTarget.style.color = 'var(--accent-red)'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; 
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)'; 
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area with comfortable inset padding and custom scrollbar */}
        <div 
          ref={contentRef}
          className="flex-1 relative bg-[var(--bg-base)] custom-scrollbar"
          style={{ padding: '24px', overflowY: 'auto' }}
        >
          {children}
        </div>
      </div>
    </div>
  , portalContainer);
}
