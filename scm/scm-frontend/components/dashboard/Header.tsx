"use client";

import { useDashboardStore, DashboardRole } from "@/store/dashboardStore";
import { exportDashboardToPDF } from "@/lib/exportPDF";
import { FileDown, Calendar, Hexagon, Settings, PackageOpen } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";

export default function Header() {
  const { activeRole, setActiveRole, dateRange, setDateRange } = useDashboardStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const roles: { id: DashboardRole; label: string; icon: React.ReactNode }[] = [
    { id: "Executive", label: "Executive", icon: <Hexagon className="w-3.5 h-3.5" /> },
    { id: "Operations", label: "Operations", icon: <Settings className="w-3.5 h-3.5" /> },
    { id: "Procurement", label: "Procurement", icon: <PackageOpen className="w-3.5 h-3.5" /> },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      await exportDashboardToPDF(activeRole);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch {
      alert("Export failed - try fullscreen first");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header
      className="relative z-40 w-full border-b shadow-sm"
      style={{ backgroundColor: "var(--bg-surface)", borderBottomColor: "var(--border-subtle)" }}
    >
      <div className="grid gap-3 px-5 py-3 xl:grid-cols-[minmax(240px,1fr)_auto_auto] xl:items-center">
        <div className="min-w-0">
          <h1
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-label)" }}
          >
            Shelf Awareness
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-center">
          {roles.map((role) => {
            const isActive = activeRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: isActive ? "var(--accent-teal)" : "var(--bg-elevated)",
                  border: `1px solid ${isActive ? "var(--accent-teal)" : "var(--border-subtle)"}`,
                  color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                  fontFamily: "var(--font-label)",
                  boxShadow: isActive ? "0 0 8px rgba(0,163,173,0.22)" : "none",
                }}
              >
                {role.icon}
                <span>{role.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div
            className="flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] font-medium"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
            <select
              value={dateRange}
              onChange={(e) => {
                if (e.target.value === "Custom") {
                  setIsCalendarOpen(true);
                } else {
                  setDateRange(e.target.value as any);
                }
              }}
              className="cursor-pointer bg-transparent py-0.5 outline-none"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-label)" }}
            >
              <option value="7D">Last 7D</option>
              <option value="30D">Last 30D</option>
              <option value="90D">Last 90D</option>
              <option value="Custom">Custom</option>
            </select>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <div className="h-0 w-0 opacity-0" />
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="end"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  borderColor: "var(--border-subtle)",
                  color: "white",
                }}
              >
                <CalendarUI
                  initialFocus
                  mode="range"
                  defaultMonth={new Date()}
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  className="bg-[var(--bg-elevated)] text-white"
                />
                <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] p-3">
                  <button
                    onClick={() => {
                      setIsCalendarOpen(false);
                      setDateRange("30D");
                    }}
                    className="rounded px-3 py-1 text-[11px] font-bold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (customRange?.from && customRange?.to) {
                        setDateRange("Custom");
                        setIsCalendarOpen(false);
                      }
                    }}
                    disabled={!customRange?.from || !customRange?.to}
                    className="rounded px-3 py-1 text-[11px] font-bold disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent-teal)", color: "#fff" }}
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
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 hover:opacity-80"
            style={{
              backgroundColor: exportSuccess ? "var(--accent-green)" : "var(--bg-surface)",
              borderColor: exportSuccess ? "var(--accent-green)" : "var(--border-subtle)",
              color: exportSuccess ? "#000000" : "var(--text-primary)",
              fontFamily: "var(--font-label)",
            }}
          >
            <FileDown className="w-3.5 h-3.5" />
            {isExporting ? "Generating..." : exportSuccess ? "Downloaded" : "Export PDF"}
          </button>
        </div>
      </div>
    </header>
  );
}
