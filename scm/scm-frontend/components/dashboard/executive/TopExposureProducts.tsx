"use client";

import { useDashboardStore } from "@/store/dashboardStore";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const getTrendDelta = (trend: number[]) => {
  if (trend.length < 2) return 0;
  const start = trend[0];
  const end = trend[trend.length - 1];
  if (start === 0) return 0;
  return ((end - start) / start) * 100;
};

const formatPHPCompact = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);

const Sparkline = ({ data, stroke }: { data: number[]; stroke: string }) => {
  const pointsData = data.length >= 2 ? data : [0, 0];
  const max = Math.max(...pointsData);
  const min = Math.min(...pointsData);
  const range = max - min || 1;
  const width = 72;
  const height = 28;
  const pad = 3;

  const points = pointsData
    .map((value, index) => {
      const x = pad + (index / (pointsData.length - 1)) * (width - 2 * pad);
      const y = pad + (height - 2 * pad) - ((value - min) / range) * (height - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");

  const lastX = width - pad;
  const lastY = pad + (height - 2 * pad) - ((pointsData[pointsData.length - 1] - min) / range) * (height - 2 * pad);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-hidden">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={stroke} />
    </svg>
  );
};

export default function TopExposureProducts() {
  const [mounted, setMounted] = useState(false);
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeSku = useDashboardStore((state) => state.filters.sku);
  const { data, isLoading } = useDashboardData();
  const exposureProducts = data?.executive?.topExposureProducts || [];
  const hasBudget = Boolean(data?.executive?.budgetPosition);
  const maxExposure = Math.max(...exposureProducts.map((item) => item.exposure), 1);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      {!exposureProducts.length && (
        <EmptyDashboardState message={isLoading ? "Loading backend exposure data..." : "No exposure products returned by backend."} />
      )}
      {exposureProducts.slice(0, 4).map((item, index) => {
        const isFaded = activeSku && activeSku !== item.sku;
        const widthPercent = Math.max(18, (item.exposure / maxExposure) * 100);
        const trendDelta = getTrendDelta(item.trend);
        const trendDirection = trendDelta > 0.2 ? "up" : trendDelta < -0.2 ? "down" : "flat";
        const trendColor = trendDirection === "up" ? "#22c55e" : trendDirection === "down" ? "#ef4444" : "#475569";
        const TrendIcon = trendDirection === "up" ? ArrowUpRight : trendDirection === "down" ? ArrowDownRight : Minus;
        const budgetColor = !hasBudget ? "var(--text-secondary)" : item.budgetUtilizationPct >= 90 ? "var(--accent-amber)" : item.budgetUtilizationPct >= 75 ? "#5B7C99" : "var(--accent-green)";
        const exposureBarColor = hasBudget && item.budgetUtilizationPct > 90 ? "#ef4444" : "#475569";

        return (
          <div
            key={item.sku}
            onClick={() => setFilter("sku", activeSku === item.sku ? null : item.sku)}
            className="relative flex cursor-pointer items-center gap-3 rounded-lg border transition-all duration-300"
            style={{
              padding: "7px 10px",
              opacity: isFaded ? 0.3 : 1,
              transform: mounted ? "translateY(0)" : "translateY(10px)",
              transitionDelay: `${index * 50}ms`,
              backgroundColor: isFaded ? "transparent" : "var(--bg-surface)",
              borderColor: isFaded ? "transparent" : "var(--border-subtle)",
            }}
          >
            <div className="relative z-10 flex w-[40px] shrink-0 items-center gap-2">
              <div
                className="flex items-center justify-center rounded font-bold font-mono"
                style={{ width: "20px", height: "20px", fontSize: "10px", backgroundColor: "var(--bg-elevated)", color: "var(--text-secondary)" }}
              >
                {item.rank}
              </div>
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: exposureBarColor }} />
            </div>

            <div className="relative z-10 flex w-[150px] shrink-0 flex-col" style={{ minWidth: "0" }}>
              <span className="block w-full truncate text-[11px] font-bold" style={{ color: "var(--text-primary)" }} title={item.name}>
                {item.name}
              </span>
              <div className="flex items-center gap-1 text-[8px] font-mono" style={{ color: "var(--text-secondary)" }}>
                <span>{item.sku}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-current opacity-50" />
                <span className="truncate">{item.category}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[7px]">
                <span className="rounded-full px-2 py-0.5 font-semibold" style={{ backgroundColor: "var(--bg-elevated)", color: budgetColor }}>
                  Budget {hasBudget ? `${item.budgetUtilizationPct.toFixed(0)}%` : "N/A"}
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{hasBudget ? `${formatPHPCompact(item.budgetRemaining)} left` : "No budget row"}</span>
              </div>
            </div>

            <div className="relative z-10 flex min-w-[120px] flex-1 flex-col justify-center gap-1">
              <div className="flex items-center justify-between text-[8px]">
                <span style={{ color: "var(--text-secondary)" }}>Exposure</span>
                <div className="flex items-center gap-1 font-bold" style={{ color: trendColor }}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{Math.abs(trendDelta).toFixed(1)}%</span>
                </div>
              </div>
              <div className="flex h-3.5 w-full items-center overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
                <div
                  className="flex h-full items-center justify-between rounded-full px-2 transition-all duration-1000 ease-out"
                  style={{
                    width: mounted ? `${widthPercent}%` : "0%",
                    backgroundColor: exposureBarColor,
                  }}
                >
                  <span className="whitespace-nowrap text-[8px] font-bold text-white font-mono">{formatPHPCompact(item.exposure)}</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex w-[74px] shrink-0 flex-col items-end gap-1">
              <Sparkline data={item.trend} stroke={trendColor} />
              <span className="text-[7px] font-medium" style={{ color: trendColor }}>
                {trendDirection === "up" ? "Up" : trendDirection === "down" ? "Down" : "Flat"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
