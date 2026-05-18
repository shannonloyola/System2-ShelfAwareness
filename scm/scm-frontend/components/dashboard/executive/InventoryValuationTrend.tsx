"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useDashboardStore } from "@/store/dashboardStore";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

const formatToMillions = (value: number) => {
  if (value >= 1000000) {
    return `PHP ${(value / 1000000).toFixed(1)}M`;
  }
  return `PHP ${value.toLocaleString()}`;
};

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    return (
      <div className="rounded border p-3 shadow-lg" style={{ backgroundColor: "#1A3A5C", borderColor: "var(--accent-teal)" }}>
        <p className="mb-1 text-[11px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
          {formatDateLabel(label)}
        </p>
        <p className="text-[14px] font-bold" style={{ color: "#FFFFFF", fontFamily: "var(--font-data)" }}>
          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(dataPoint.value)}
        </p>
        {dataPoint.isAnomaly && (
          <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--accent-amber)", fontFamily: "var(--font-label)" }}>
            Review variance
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function InventoryValuationTrend() {
  const setFilter = useDashboardStore((state) => state.setFilter);
  const dateRange = useDashboardStore((state) => state.dateRange);
  const { data, isLoading } = useDashboardData();

  const processedData = useMemo(() => {
    let chartData = data?.executive?.inventoryValuationTrend || [];

    if (dateRange === "7D") chartData = chartData.slice(-7);
    else if (dateRange === "30D") chartData = chartData.slice(-30);

    const values = chartData.map((item) => item.value);
    if (values.length === 0) return [];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length);

    return chartData.map((item) => ({
      ...item,
      isAnomaly: stdDev > 0 && Math.abs((item.value - mean) / stdDev) > 2.0,
    }));
  }, [data, dateRange]);

  if (!processedData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend valuation data..." : "No backend valuation trend available."} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={processedData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        onClick={(event) => {
          if (event?.activePayload) {
            setFilter("status", event.activePayload[0].payload.date);
          }
        }}
      >
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.75} />
            <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value, index) =>
            index % Math.max(1, Math.floor(processedData.length / 4)) === 0 ? formatDateLabel(value) : ""
          }
          tick={{ fontSize: 9, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border-subtle)" }}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={formatToMillions}
          tick={{ fontSize: 9, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--accent-teal)"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorValue)"
          animationDuration={1200}
          activeDot={{ r: 5, fill: "var(--accent-teal)", stroke: "var(--bg-surface)", strokeWidth: 2 }}
          dot={(props: any) =>
            props.payload?.isAnomaly ? <circle cx={props.cx} cy={props.cy} r={4} fill="var(--accent-amber)" stroke="none" /> : null
          }
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
