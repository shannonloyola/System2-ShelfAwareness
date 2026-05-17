"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

export default function BackorderRootCausePareto() {
  const { data, isLoading } = useDashboardData();
  const chartData = (data?.operations?.backorderAging || [])
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.bucket,
      count: item.count,
      value: item.value,
    }));

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend backorder data..." : "No backorder records returned by inventory service."} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 12, right: 18, left: -12, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} />
        <Tooltip />
        <Bar dataKey="count" fill="var(--accent-teal)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
