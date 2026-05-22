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

const renderAnomalyDot = (props: any) => {
  if (!props.payload?.isAnomaly) {
    return null;
  }

  const dotKey = props.payload?.date ?? props.index ?? `${props.cx}-${props.cy}`;

  return (
    <circle
      key={`inventory-valuation-dot-${dotKey}`}
      cx={props.cx}
      cy={props.cy}
      r={4}
      fill="var(--accent-amber)"
      stroke="none"
    />
  );
};

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

  if (processedData.length === 1) {
    const point = processedData[0];
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl border p-5 shadow-sm"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--bg-elevated)",
          }}
        >
          <div
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "var(--accent-teal)", fontFamily: "var(--font-label)" }}
          >
            First Snapshot Captured
          </div>
          <div
            className="mt-3 text-[28px] font-bold tracking-tight"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-data)" }}
          >
            {new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
              maximumFractionDigits: 0,
            }).format(point.value)}
          </div>
          <div
            className="mt-2 text-[12px]"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}
          >
            Snapshot date: {formatDateLabel(point.date)}
          </div>
          <div
            className="mt-4 rounded-xl border px-3 py-3 text-[12px] leading-5"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-secondary)",
            }}
          >
            The trend line will appear after at least one more daily valuation snapshot is captured.
          </div>
        </div>
      </div>
    );
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
          dot={renderAnomalyDot}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
