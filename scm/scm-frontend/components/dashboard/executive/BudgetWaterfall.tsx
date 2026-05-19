"use client";

import { useMemo } from "react";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatPHPCompact = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    notation: value >= 1000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);

export default function BudgetWaterfall() {
  const { data, isLoading } = useDashboardData();

  const summary = useMemo(() => {
    return data?.executive?.budgetPosition || null;
  }, [data]);

  if (!summary || summary.allocated <= 0) {
    return <EmptyDashboardState message={isLoading ? "Loading backend budget data..." : "No current budget allocation returned by procurement service."} />;
  }

  return (
    <div className="flex h-full w-full flex-col justify-center">
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
    </div>
  );
}
