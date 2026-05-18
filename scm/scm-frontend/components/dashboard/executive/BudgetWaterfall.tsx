"use client";

import { useMemo } from "react";
import { useDashboardStore } from "@/store/dashboardStore";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatPHPCompact = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);

export default function BudgetWaterfall() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeCategoryFilter = useDashboardStore((state) => state.filters.category);
  const { data, isLoading } = useDashboardData();

  const summary = useMemo(() => {
    return data?.executive?.budgetPosition || null;
  }, [data]);

  if (!summary || summary.allocated <= 0) {
    return <EmptyDashboardState message={isLoading ? "Loading backend budget data..." : "No current budget allocation returned by procurement service."} />;
  }

  const categoryRows = summary.categories?.length
    ? summary.categories.slice(0, 3)
    : [{ category: "Current Budget", allocated: summary.allocated, spent: summary.spent, committed: summary.committed }];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid grid-cols-3 gap-2 border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Allocated
          </div>
          <div className="mt-1 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
            {formatPHPCompact(summary.allocated)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Spent + committed
          </div>
          <div className="mt-1 text-[15px] font-bold" style={{ color: "var(--accent-teal)" }}>
            {formatPHPCompact(summary.spent + summary.committed)}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            Remaining
          </div>
          <div className="mt-1 text-[15px] font-bold" style={{ color: "var(--accent-green)" }}>
            {formatPHPCompact(summary.remaining)}
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-full" style={{ backgroundColor: "var(--bg-elevated)", height: "10px", overflow: "hidden" }}>
        <div className="flex h-full w-full">
          <div
            style={{
              width: `${Math.min(100, (summary.spent / summary.allocated) * 100)}%`,
              backgroundColor: "#5B7C99",
            }}
          />
          <div
            style={{
              width: `${Math.min(100, (summary.committed / summary.allocated) * 100)}%`,
              backgroundColor: "#8EA5B8",
            }}
          />
          <div
            style={{
              width: `${Math.min(100, (summary.remaining / summary.allocated) * 100)}%`,
              backgroundColor: "var(--accent-green)",
            }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[8px]" style={{ color: "var(--text-secondary)" }}>
        <span>{summary.usedPct.toFixed(1)}% already spoken for</span>
        <span>Blue = spent, slate = committed, green = remaining</span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {categoryRows.map((row) => {
          const isActive = activeCategoryFilter === row.category;
          const spentPct = (row.spent / row.allocated) * 100;
          const committedPct = (row.committed / row.allocated) * 100;
          const remainingPct = 100 - spentPct - committedPct;
          const statusColor = spentPct >= 90 ? "var(--accent-amber)" : spentPct >= 75 ? "#5B7C99" : "var(--accent-green)";

          return (
            <button
              key={row.category}
              onClick={() => setFilter("category", isActive ? null : row.category)}
              className="w-full rounded-lg border px-2 py-1.5 text-left transition-opacity hover:opacity-85"
              style={{
                borderColor: isActive ? "var(--accent-teal)" : "var(--border-subtle)",
                backgroundColor: isActive ? "rgba(0, 163, 173, 0.05)" : "var(--bg-surface)",
                opacity: activeCategoryFilter && !isActive ? 0.35 : 1,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {row.category}
                  </div>
                  <div className="mt-0.5 text-[8px]" style={{ color: "var(--text-secondary)" }}>
                    Allocated {formatPHPCompact(row.allocated)}
                  </div>
                </div>
                <div
                  className="rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    color: statusColor,
                    backgroundColor: spentPct >= 90 ? "rgba(245, 158, 11, 0.08)" : spentPct >= 75 ? "rgba(91, 124, 153, 0.10)" : "rgba(16, 185, 129, 0.08)",
                    fontFamily: "var(--font-label)",
                  }}
                >
                  {spentPct >= 90 ? "Tight" : spentPct >= 75 ? "Managed" : "Healthy"}
                </div>
              </div>

              <div className="mt-1.5 rounded-full" style={{ backgroundColor: "var(--bg-elevated)", height: "7px", overflow: "hidden" }}>
                <div className="flex h-full w-full">
                  <div style={{ width: `${spentPct}%`, backgroundColor: "#5B7C99" }} />
                  <div style={{ width: `${committedPct}%`, backgroundColor: "#8EA5B8" }} />
                  <div style={{ width: `${remainingPct}%`, backgroundColor: "var(--accent-green)" }} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[8px]">
                <span style={{ color: "var(--text-secondary)" }}>Used {Math.round(spentPct)}%</span>
                <span className="font-bold" style={{ color: statusColor }}>
                  {formatPHPCompact(row.allocated - row.spent - row.committed)} left
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
