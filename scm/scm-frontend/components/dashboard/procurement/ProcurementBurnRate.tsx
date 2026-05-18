"use client";

import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatPhp = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function ProcurementBurnRate() {
  const { data, isLoading } = useDashboardData();
  const budget = data?.executive?.budgetPosition;

  if (!budget || budget.allocated <= 0) {
    return <EmptyDashboardState message={isLoading ? "Loading backend budget data..." : "No procurement budget data returned by procurement service."} />;
  }

  const spentPct = budget.allocated > 0 ? (budget.spent / budget.allocated) * 100 : 0;
  const committedPct = budget.allocated > 0 ? (budget.committed / budget.allocated) * 100 : 0;
  const remainingPct = Math.max(0, 100 - spentPct - committedPct);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div><div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Allocated</div><div className="font-mono text-[16px] font-bold">{formatPhp(budget.allocated)}</div></div>
        <div><div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Spent + Committed</div><div className="font-mono text-[16px] font-bold">{formatPhp(budget.spent + budget.committed)}</div></div>
        <div><div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Remaining</div><div className="font-mono text-[16px] font-bold" style={{ color: "var(--accent-green)" }}>{formatPhp(budget.remaining)}</div></div>
      </div>
      <div className="h-4 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
        <div className="flex h-full">
          <div style={{ width: `${spentPct}%`, backgroundColor: "#475569" }} />
          <div style={{ width: `${committedPct}%`, backgroundColor: "#8EA5B8" }} />
          <div style={{ width: `${remainingPct}%`, backgroundColor: "var(--accent-green)" }} />
        </div>
      </div>
    </div>
  );
}
