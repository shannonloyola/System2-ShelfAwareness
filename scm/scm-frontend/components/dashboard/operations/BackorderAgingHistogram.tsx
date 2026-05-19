"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardStore } from "@/store/dashboardStore";
import { List, X } from "lucide-react";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatPHP = (val: number) => {
  if (val >= 1000000) return `P${(val / 1000000).toFixed(1)}M`;
  return `P${(val / 1000).toFixed(0)}k`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="min-w-[180px] rounded border p-3 shadow-lg" style={{ backgroundColor: "#1A3A5C", borderColor: data.color }}>
      <p className="mb-2 text-[12px] font-bold text-white">{data.bucket} Aging</p>
      <div className="flex flex-col gap-1 text-[11px] font-mono">
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Orders:</span><span className="font-bold text-white">{data.count}</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Value:</span><span className="font-bold text-white">P{Number(data.value).toLocaleString()}</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Critical:</span><span className="font-bold text-red-400">{data.critical}</span></div>
        <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Avg Wait:</span><span className="font-bold text-white">{data.avgDaysWaiting} days</span></div>
      </div>
    </div>
  );
};

export default function BackorderAgingHistogram() {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeBucket = useDashboardStore((state) => state.filters.bucket);
  const { data, isLoading } = useDashboardData();
  const chartData = data?.operations?.backorderAging || [];
  const backorderDetails = data?.operations?.backorderDetails || [];
  const selectedRows = useMemo(() => {
    if (!selectedBucket) return [];
    return backorderDetails.filter((row) => row.bucket === selectedBucket);
  }, [backorderDetails, selectedBucket]);

  const totalOrders = chartData.reduce((acc, item) => acc + item.count, 0);
  const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
  const avgWait = totalOrders > 0 ? (chartData.reduce((acc, item) => acc + item.avgDaysWaiting * item.count, 0) / totalOrders).toFixed(1) : "0.0";
  const oldest = chartData.length ? Math.max(...chartData.map((item) => item.avgDaysWaiting)).toFixed(0) : "0";

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend backorder data..." : "No backorder aging data returned by inventory service."} />;
  }

  return (
    <div className="relative flex h-full w-full flex-col pb-2 pt-2">
      <button
        type="button"
        onClick={() => setSelectedBucket(activeBucket || chartData.find((item) => item.count > 0)?.bucket || chartData[0]?.bucket || null)}
        className="absolute right-2 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-md border transition-colors hover:bg-[var(--bg-elevated)]"
        style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", backgroundColor: "var(--bg-surface)" }}
        aria-label="Open backorder detail table"
        title="Open backorder detail table"
      >
        <List className="h-4 w-4" />
      </button>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 28 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="emoji" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={{ stroke: "var(--border-subtle)" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatPHP} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar
              yAxisId="left"
              dataKey="count"
              fill="var(--accent-teal)"
              radius={[2, 2, 0, 0]}
              cursor="pointer"
              onClick={(entry: any) => {
                if (!entry?.bucket) return;
                setFilter("bucket", activeBucket === entry.bucket ? null : entry.bucket);
                setSelectedBucket(entry.bucket);
              }}
            >
              {chartData.map((entry) => <Cell key={`count-${entry.bucket}`} opacity={activeBucket && activeBucket !== entry.bucket ? 0.3 : 1} />)}
            </Bar>
            <Bar
              yAxisId="right"
              dataKey="value"
              fill="var(--accent-amber)"
              radius={[2, 2, 0, 0]}
              cursor="pointer"
              onClick={(entry: any) => {
                if (!entry?.bucket) return;
                setFilter("bucket", activeBucket === entry.bucket ? null : entry.bucket);
                setSelectedBucket(entry.bucket);
              }}
            >
              {chartData.map((entry) => <Cell key={`value-${entry.bucket}`} opacity={activeBucket && activeBucket !== entry.bucket ? 0.3 : 0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between border-t px-4 pt-3 text-[10px]" style={{ borderColor: "var(--border-subtle)", fontFamily: "var(--font-label)", minHeight: "34px" }}>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Total Backorders</span><span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{totalOrders}</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Value at Risk</span><span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>P{totalValue.toLocaleString()}</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Avg Wait</span><span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>{avgWait} days</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Oldest</span><span className="font-mono font-bold text-red-400">{oldest} days</span></div>
      </div>

      {selectedBucket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[78vh] w-full max-w-3xl flex-col rounded-lg border shadow-2xl" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
                  Backorder Details
                </div>
                <div className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>{selectedBucket}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ color: "var(--text-secondary)" }}
                aria-label="Close backorder details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-auto p-4">
              {!selectedRows.length ? (
                <EmptyDashboardState message="No SKU-level rows returned for this backorder bucket." />
              ) : (
                <table className="w-full border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.12em]">SKU</th>
                      <th className="px-3 py-2 font-semibold uppercase tracking-[0.12em]">Product</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.12em]">Quantity</th>
                      <th className="px-3 py-2 text-right font-semibold uppercase tracking-[0.12em]">Days Aged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRows.map((row, index) => (
                      <tr key={`${row.sku}-${index}`} className="border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                        <td className="px-3 py-2 font-mono" style={{ color: "var(--text-primary)" }}>{row.sku}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>{row.name}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: "var(--text-primary)" }}>{row.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono" style={{ color: row.daysAged >= 30 ? "var(--accent-red)" : "var(--text-primary)" }}>{row.daysAged}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
