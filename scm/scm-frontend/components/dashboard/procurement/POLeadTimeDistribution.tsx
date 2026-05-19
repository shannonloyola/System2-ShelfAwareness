"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

export default function POLeadTimeDistribution() {
  const { data, isLoading } = useDashboardData();
  const chartData = (data?.procurement?.supplierLeadTimeDistribution || [])
    .filter((item) => item.leadTimeDays > 0)
    .map((item) => ({
      supplierName: item.supplierName,
      days: item.leadTimeDays,
      leadTimeDays: item.leadTimeDays,
      totalPos: item.totalPos,
      source: item.source,
      color: item.color,
    }));

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend supplier lead-time data..." : "No supplier lead-time data returned by supplier/procurement services."} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 18, left: 20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} label={{ value: "Days", position: "insideBottomRight", offset: -2, fill: "var(--text-secondary)", fontSize: 10 }} />
        <YAxis type="category" dataKey="supplierName" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} width={130} />
        <Bar dataKey="days" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.supplierName} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
