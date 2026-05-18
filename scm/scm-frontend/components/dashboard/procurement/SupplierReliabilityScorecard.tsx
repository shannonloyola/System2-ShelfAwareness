"use client";

import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

export default function SupplierReliabilityScorecard() {
  const { data, isLoading } = useDashboardData();
  const rows = (data?.operations?.stockMovementFeed || [])
    .filter((event) => event.triggeredBy === "Procurement service")
    .reduce<Record<string, { supplier: string; total: number; received: number; pending: number }>>((acc, event) => {
      const supplier = event.productName || "Supplier";
      acc[supplier] ||= { supplier, total: 0, received: 0, pending: 0 };
      acc[supplier].total += 1;
      if (event.status.includes("received") || event.status.includes("completed")) acc[supplier].received += 1;
      if (event.status.includes("pending") || event.status.includes("draft") || event.status.includes("transit")) acc[supplier].pending += 1;
      return acc;
    }, {});

  const suppliers = Object.values(rows).slice(0, 5);

  if (!suppliers.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend supplier data..." : "No supplier-linked PO records returned by procurement service."} />;
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-hidden">
      {suppliers.map((supplier) => {
        const completion = supplier.total > 0 ? (supplier.received / supplier.total) * 100 : 0;
        return (
          <div key={supplier.supplier} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{supplier.supplier}</div>
                <div className="text-[9px]" style={{ color: "var(--text-secondary)" }}>{supplier.total} PO events | {supplier.pending} open</div>
              </div>
              <div className="font-mono text-[12px] font-bold" style={{ color: completion >= 80 ? "var(--accent-green)" : "var(--accent-amber)" }}>{completion.toFixed(0)}%</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
              <div className="h-full rounded-full" style={{ width: `${completion}%`, backgroundColor: completion >= 80 ? "var(--accent-green)" : "var(--accent-amber)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
