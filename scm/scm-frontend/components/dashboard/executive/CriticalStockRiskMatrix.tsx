"use client";

import { useMemo } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatPHP = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

export default function CriticalStockRiskMatrix() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeSkuFilter = useDashboardStore((state) => state.filters.sku);
  const { data, isLoading } = useDashboardData();

  const criticalItems = useMemo(() => {
    return (data?.executive?.criticalStockProducts || [])
      .sort((a, b) => (a.daysOfCover ?? 999) - (b.daysOfCover ?? 999) || b.value - a.value);
  }, [data]);

  if (!criticalItems.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend stock risk data..." : "No critical stock products returned by backend."} />;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="grid grid-cols-3 gap-3 rounded-lg border p-3"
        style={{
          backgroundColor: "rgba(239, 68, 68, 0.04)",
          borderColor: "rgba(239, 68, 68, 0.16)",
        }}
      >
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Critical SKUs
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--accent-red)" }}>
            {criticalItems.length}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Lowest Cover
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
            {criticalItems[0]?.daysOfCover != null ? `${criticalItems[0].daysOfCover.toFixed(1)}d` : "--"}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Value At Risk
          </div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
            {formatPHP(criticalItems.reduce((sum, item) => sum + item.value, 0))}
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1" style={{ scrollbarGutter: "stable" }}>
        <div className="space-y-1.5">
          {criticalItems.map((item) => {
            const isActive = activeSkuFilter === item.sku;
            return (
              <button
                key={item.sku}
                onClick={() => setFilter("sku", isActive ? null : item.sku)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-opacity hover:opacity-85"
                style={{
                  borderColor: isActive ? "var(--accent-red)" : "var(--border-subtle)",
                  backgroundColor: isActive ? "rgba(239, 68, 68, 0.06)" : "var(--bg-elevated)",
                  opacity: activeSkuFilter && !isActive ? 0.35 : 1,
                }}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[8px]" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-mono">{item.sku}</span>
                        <span>{item.category}</span>
                      </div>
                    </div>
                    <div
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        color: "var(--accent-red)",
                        fontFamily: "var(--font-label)",
                      }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Critical
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[9px]">
                    <div>
                      <div style={{ color: "var(--text-secondary)" }}>Stock on hand</div>
                      <div className="font-bold" style={{ color: "var(--text-primary)" }}>{item.stockLevel} units</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-secondary)" }}>Daily movement</div>
                      <div className="font-bold" style={{ color: "var(--text-primary)" }}>{item.dailyMovement != null ? `${item.dailyMovement.toFixed(1)}/day` : "--"}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--text-secondary)" }}>Days of cover</div>
                      <div className="font-bold" style={{ color: "var(--accent-red)" }}>{item.daysOfCover != null ? `${item.daysOfCover.toFixed(1)} days` : "--"}</div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[9px]" style={{ color: "var(--text-secondary)" }}>Exposure</div>
                  <div className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>{formatPHP(item.value)}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: "var(--accent-teal)" }}>
                    Raise PO
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
