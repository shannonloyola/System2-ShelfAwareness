"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const COLORS = ["#00A3AD", "#22c55e", "#f59e0b", "#ef4444", "#64748b", "#8EA5B8"];
const NO_DATA_LABEL = "N/A";

type SupplierSlice = {
  supplierName: string;
  reliabilityScore: number;
  onTimeDeliveryPct: number;
  defectRate: number;
  poApprovalRate: number;
  riskLevel: string;
  totalPos: number;
  totalReceipts: number;
  leadTimeDays: number | null;
  color: string;
};

const safeText = (value: unknown, fallback = NO_DATA_LABEL) => {
  const text = String(value ?? "").trim();
  if (!text || ["null", "undefined", "nan"].includes(text.toLowerCase())) {
    return fallback;
  }
  return text;
};

const safeNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const safeNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatPercent = (value: number, digits = 0) => `${safeNumber(value).toFixed(digits)}%`;
const formatLeadTime = (value: number | null) => (value != null ? `${safeNumber(value).toFixed(0)}d` : NO_DATA_LABEL);

const ActiveSlice = (props: any) => (
  <g>
    <Sector
      {...props}
      fill={props.fill}
      stroke="var(--bg-surface)"
      strokeWidth={2}
      outerRadius={Number(props.outerRadius || 0) + 5}
      opacity={0.96}
      style={{ filter: "drop-shadow(0 6px 12px rgba(15, 23, 42, 0.16))" }}
    />
  </g>
);

export default function SupplierReliabilityScorecard() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { data, isLoading } = useDashboardData();

  const suppliers = useMemo<SupplierSlice[]>(() => {
    return (data?.procurement?.supplierReliabilityScorecards ?? [])
      .map((supplier, index) => ({
        supplierName: safeText(supplier?.supplierName, `Supplier ${index + 1}`),
        reliabilityScore: safeNumber(supplier?.reliabilityScore),
        onTimeDeliveryPct: safeNumber(supplier?.onTimeDeliveryPct),
        defectRate: safeNumber(supplier?.defectRate),
        poApprovalRate: safeNumber(supplier?.poApprovalRate),
        riskLevel: safeText(supplier?.riskLevel, "medium"),
        totalPos: safeNumber(supplier?.totalPos),
        totalReceipts: safeNumber(supplier?.totalReceipts),
        leadTimeDays: safeNullableNumber(supplier?.leadTimeDays),
        color: COLORS[index % COLORS.length],
      }))
      .filter((supplier) => supplier.reliabilityScore > 0)
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, 6)
      .map((supplier, index) => ({
        ...supplier,
        color: COLORS[index % COLORS.length],
      }));
  }, [data]);

  const activeSupplier = activeIndex != null && suppliers[activeIndex] ? suppliers[activeIndex] : null;
  if (!suppliers.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend supplier reliability data..." : "No supplier reliability scorecards returned by supplier service."} />;
  }

  return (
    <div
      className="grid h-full w-full grid-cols-1 gap-3 overflow-hidden md:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]"
    >
      <div className="min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart onMouseLeave={() => setActiveIndex(null)}>
            <Pie
              data={suppliers}
              dataKey="reliabilityScore"
              nameKey="supplierName"
              cx="50%"
              cy="50%"
              outerRadius="78%"
              innerRadius={activeSupplier ? "42%" : "0%"}
              paddingAngle={2}
              activeIndex={activeIndex ?? undefined}
              activeShape={ActiveSlice}
              isAnimationActive
              animationDuration={420}
              animationEasing="ease-out"
              onMouseEnter={(_entry: any, index: number) => setActiveIndex(index)}
              onMouseOver={(_entry: any, index: number) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {suppliers.map((supplier, index) => (
                <Cell
                  key={`${supplier.supplierName}-${index}`}
                  fill={supplier.color}
                  stroke="var(--bg-surface)"
                  strokeWidth={1.5}
                  opacity={activeIndex == null || activeIndex === index ? 1 : 0.45}
                  style={{
                    outline: "none",
                    transition: "opacity 160ms ease, filter 160ms ease",
                    filter: activeIndex === index ? "saturate(1.08)" : "none",
                  }}
                />
              ))}
            </Pie>
            {activeSupplier && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">
                <>
                  <tspan x="50%" dy="-1.1em" style={{ fill: "var(--text-primary)", fontSize: 11, fontWeight: 700 }}>
                    {activeSupplier.supplierName}
                  </tspan>
                  <tspan x="50%" dy="1.35em" style={{ fill: activeSupplier.color, fontSize: 16, fontWeight: 800, fontFamily: "var(--font-data)" }}>
                    {formatPercent(activeSupplier.reliabilityScore)}
                  </tspan>
                  <tspan x="50%" dy="1.25em" style={{ fill: "var(--text-secondary)", fontSize: 9, fontWeight: 600 }}>
                    Lead {formatLeadTime(activeSupplier.leadTimeDays)}
                  </tspan>
                </>
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="min-h-0 overflow-y-auto pr-1">
        {activeSupplier ? (
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: activeSupplier.color,
              backgroundColor: "var(--bg-elevated)",
              boxShadow: `0 12px 28px ${activeSupplier.color}22`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  {activeSupplier.supplierName}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Reliability", formatPercent(activeSupplier.reliabilityScore)],
                ["Lead Time", formatLeadTime(activeSupplier.leadTimeDays)],
                ["Defects", formatPercent(activeSupplier.defectRate, 1)],
                ["On-Time", formatPercent(activeSupplier.onTimeDeliveryPct, 1)],
                ["Approval", formatPercent(activeSupplier.poApprovalRate, 1)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
                  <div className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>{label}</div>
                  <div className="mt-1 font-mono text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {suppliers.map((supplier, index) => (
              <div key={`${supplier.supplierName}-${index}`} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <div className="truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{supplier.supplierName}</div>
                    </div>
                    <div className="mt-1 text-[9px]" style={{ color: "var(--text-secondary)" }}>
                      {supplier.totalPos} POs | {formatLeadTime(supplier.leadTimeDays)} lead | {formatPercent(supplier.defectRate, 1)} defects
                    </div>
                  </div>
                  <div className="font-mono text-[13px] font-bold" style={{ color: supplier.reliabilityScore >= 85 ? "var(--accent-green)" : supplier.reliabilityScore >= 70 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                    {formatPercent(supplier.reliabilityScore)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
