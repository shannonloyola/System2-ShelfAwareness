"use client";

import { useDashboardStore, DashboardRole } from '@/store/dashboardStore';
import { exportDashboardToPDF } from '@/lib/exportPDF';
import { FileDown, Calendar, Hexagon, Settings, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

export default function Header() {
  const { activeRole, setActiveRole, dateRange, setDateRange } = useDashboardStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const roles: { id: DashboardRole; label: string; icon: React.ReactNode }[] = [
    { id: 'Executive', label: 'Executive', icon: <Hexagon className="w-3.5 h-3.5" /> },
    { id: 'Operations', label: 'Operations', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'Procurement', label: 'Procurement', icon: <PackageOpen className="w-3.5 h-3.5" /> },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await exportDashboardToPDF(activeRole);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      alert("Export failed — try fullscreen first");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="relative w-full z-40 flex items-center justify-between border-b shadow-sm" style={{ height: '52px', backgroundColor: 'var(--bg-surface)', borderBottomColor: 'var(--border-subtle)' }}>
      {/* Left: Wordmark */}
      <div className="flex flex-col justify-center flex-1" style={{ paddingLeft: '20px' }}>
        <h1 className="text-sm font-bold tracking-wide uppercase truncate" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-label)' }}>Shelf Awareness</h1>
        <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-label)' }}>Medical Logistics</span>
      </div>

      {/* Center: Role Switcher */}
      <div className="absolute left-1/2 lg:left-[calc(50vw-256px)] top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-2">
        {roles.map((role) => {
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all uppercase tracking-wider ${
                isActive 
                  ? 'border shadow-[0_0_8px_rgba(0,163,173,0.3)]' 
                  : 'border hover:border-text-secondary'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--accent-teal)' : 'var(--bg-elevated)',
                borderColor: isActive ? 'var(--accent-teal)' : 'var(--border-subtle)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                fontFamily: 'var(--font-label)'
              }}
            >
              {role.icon}
              <span>{role.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-[8px] flex-1" style={{ paddingRight: '20px' }}>
        <div className="flex items-center gap-2 border rounded-md px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
          <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          <select 
            value={dateRange}
            onChange={(e) => {
              if (e.target.value === 'Custom') {
                setIsCalendarOpen(true);
              } else {
                setDateRange(e.target.value as any);
              }
            }}
            className="bg-transparent outline-none cursor-pointer py-0.5"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-label)' }}
          >
            <option value="7D">Last 7D</option>
            <option value="30D">Last 30D</option>
            <option value="90D">Last 90D</option>
            <option value="Custom">Custom</option>
          </select>
          
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <div className="w-0 h-0 opacity-0" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'white' }}>
              <CalendarUI
                initialFocus
                mode="range"
                defaultMonth={new Date()}
                selected={customRange}
                onSelect={setCustomRange}
                numberOfMonths={2}
                className="bg-[var(--bg-elevated)] text-white"
              />
              <div className="p-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
                <button 
                  onClick={() => {
                    setIsCalendarOpen(false);
                    setDateRange('30D'); // revert if cancel
                  }}
                  className="px-3 py-1 rounded text-[11px] font-bold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (customRange?.from && customRange?.to) {
                      setDateRange('Custom');
                      setIsCalendarOpen(false);
                    }
                  }}
                  disabled={!customRange?.from || !customRange?.to}
                  className="px-3 py-1 rounded text-[11px] font-bold disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-teal)', color: '#fff' }}
                >
                  Apply Range
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 hover:opacity-80"
          style={{ 
            backgroundColor: exportSuccess ? 'var(--accent-green)' : 'var(--bg-surface)', 
            borderColor: exportSuccess ? 'var(--accent-green)' : 'var(--border-subtle)', 
            color: exportSuccess ? '#000000' : 'var(--text-primary)', 
            fontFamily: 'var(--font-label)' 
          }}
        >
          <FileDown className="w-3.5 h-3.5" />
          {isExporting ? 'Generating...' : exportSuccess ? '✓ Downloaded' : 'Export PDF'}
        </button>
      </div>
    </header>
  );
}
