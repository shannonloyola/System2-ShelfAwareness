"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardStore } from "@/store/dashboardStore";
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
  const setFilter = useDashboardStore((state) => state.setFilter);
  const activeBucket = useDashboardStore((state) => state.filters.bucket);
  const { data, isLoading } = useDashboardData();
  const chartData = data?.operations?.backorderAging || [];

  const totalOrders = chartData.reduce((acc, item) => acc + item.count, 0);
  const totalValue = chartData.reduce((acc, item) => acc + item.value, 0);
  const avgWait = totalOrders > 0 ? (chartData.reduce((acc, item) => acc + item.avgDaysWaiting * item.count, 0) / totalOrders).toFixed(1) : "0.0";
  const oldest = chartData.length ? Math.max(...chartData.map((item) => item.avgDaysWaiting)).toFixed(0) : "0";

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend backorder data..." : "No backorder aging data returned by inventory service."} />;
  }

  return (
    <div className="relative flex h-full w-full flex-col pb-2 pt-2">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 28 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="emoji" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={{ stroke: "var(--border-subtle)" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatPHP} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar yAxisId="left" dataKey="count" fill="var(--accent-teal)" radius={[2, 2, 0, 0]} onClick={(entry: any) => entry?.bucket && setFilter("bucket", activeBucket === entry.bucket ? null : entry.bucket)}>
              {chartData.map((entry) => <Cell key={`count-${entry.bucket}`} opacity={activeBucket && activeBucket !== entry.bucket ? 0.3 : 1} />)}
            </Bar>
            <Bar yAxisId="right" dataKey="value" fill="var(--accent-amber)" radius={[2, 2, 0, 0]} onClick={(entry: any) => entry?.bucket && setFilter("bucket", activeBucket === entry.bucket ? null : entry.bucket)}>
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
    </div>
  );
}
