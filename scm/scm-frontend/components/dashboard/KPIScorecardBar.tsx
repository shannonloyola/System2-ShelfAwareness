"use client";

import { useDashboardStore } from "@/store/dashboardStore";
import { ArrowUpRight, ArrowDownRight, Minus, X } from "lucide-react";
import { useDashboardData } from "./DashboardDataContext";

interface KPIData {
  label: string;
  value: string;
  delta: number;
  inverseGood?: boolean;
  trend: number[];
  subLabel?: React.ReactNode;
}

const Sparkline = ({ data, stroke }: { data: number[]; stroke: string }) => {
  const width = 54;
  const height = 24;
  const pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = pad + (idx / (data.length - 1)) * (width - pad * 2);
      const y = pad + (height - pad * 2) - ((val - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const endX = width - pad;
  const endY = pad + (height - pad * 2) - ((last - min) / range) * (height - pad * 2);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-hidden">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={endX} cy={endY} r="2.5" fill={stroke} />
    </svg>
  );
};

export default function KPIScorecardBar() {
  const { activeRole, filters, clearFilters, setFilter } = useDashboardStore();
  const { data, isLoading } = useDashboardData();
  const kpis = (data?.kpis?.[activeRole] || []).slice(0, 5) as KPIData[];
  const displayKpis: KPIData[] = isLoading && kpis.length === 0
    ? Array.from({ length: 5 }).map(() => ({
        label: "Loading backend data",
        value: "--",
        delta: 0,
        trend: [0, 0],
      }))
    : kpis;
  const activeFilterKeys = Object.entries(filters).filter(([_, val]) => val !== null);

  return (
    <div id="kpi-scorecard-bar" className="flex w-full flex-col border-b" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
      <div className="grid w-full grid-cols-1 gap-3 px-5 py-3 sm:grid-cols-2 xl:grid-cols-5">
        {displayKpis.map((kpi, idx) => {
          let deltaColor = "var(--accent-teal)";
          let trendColor = "var(--accent-teal)";
          let DeltaIcon = Minus;
          const useStrictExecutiveTrend = activeRole === "Executive" && idx < 4;
          const useStrictOperationsLogic = activeRole === "Operations";

          if (kpi.delta > 0) {
            deltaColor = useStrictExecutiveTrend
              ? "#22c55e"
              : useStrictOperationsLogic
                ? (kpi.inverseGood ? "#ef4444" : "#22c55e")
                : kpi.inverseGood ? "var(--accent-amber)" : "var(--accent-green)";
            trendColor = deltaColor;
            DeltaIcon = ArrowUpRight;
          } else if (kpi.delta < 0) {
            deltaColor = useStrictExecutiveTrend
              ? "#ef4444"
              : useStrictOperationsLogic
                ? (kpi.inverseGood ? "#22c55e" : "#ef4444")
                : kpi.inverseGood ? "var(--accent-green)" : "var(--accent-amber)";
            trendColor = deltaColor;
            DeltaIcon = ArrowDownRight;
          }

          return (
            <div
              key={idx}
              className="grid min-h-[98px] grid-cols-[minmax(0,1fr)_54px] items-center gap-3 rounded-xl border px-4 py-3 shadow-sm"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div className="min-w-0">
                <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
                  {kpi.label}
                </span>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span
                    className="font-bold tracking-tight"
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "21px",
                      fontFamily: "var(--font-data)",
                      lineHeight: "1.05",
                      wordBreak: "break-word",
                    }}
                  >
                    {kpi.value}
                  </span>
                  {kpi.delta !== 0 && (
                    <div className="flex items-center rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[9px] font-bold" style={{ color: deltaColor }}>
                      <DeltaIcon className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                      <span>{Math.abs(kpi.delta)}%</span>
                    </div>
                  )}
                </div>
                {kpi.subLabel && (
                  <span className="mt-1 block text-[10px] leading-none" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
                    {kpi.subLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end self-stretch overflow-hidden">
                <Sparkline data={kpi.trend} stroke={trendColor} />
              </div>
            </div>
          );
        })}
      </div>

      {activeFilterKeys.length > 0 && (
        <div className="flex items-center overflow-hidden px-5 py-2" style={{ gap: "8px" }}>
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Active Filters:
          </span>
          {activeFilterKeys.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded-full border px-3 text-[10px] transition-colors"
              style={{
                height: "24px",
                backgroundColor: "rgba(0, 163, 173, 0.12)",
                borderColor: "rgba(0, 163, 173, 0.18)",
                color: "var(--accent-teal)",
                fontFamily: "var(--font-label)",
              }}
            >
              <span className="capitalize opacity-80">{key}:</span>
              <span className="font-bold">{value}</span>
              <button onClick={() => setFilter(key as any, null)} className="ml-1 rounded-full p-0.5 transition-opacity hover:bg-black/10 hover:opacity-70">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={clearFilters}
            className="flex items-center rounded-full border px-3 text-[10px] font-bold transition-all hover:opacity-80"
            style={{ height: "24px", borderColor: "var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "var(--bg-elevated)" }}
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
