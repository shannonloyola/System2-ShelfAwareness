"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

export default function POLeadTimeDistribution() {
  const { data, isLoading } = useDashboardData();
  const chartData = (data?.operations?.transferVelocityFunnel || [])
    .filter((item) => item.count > 0)
    .map((item) => ({
      stage: item.stage,
      hours: item.avgHoursInStage,
      count: item.count,
    }));

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend PO stage data..." : "No PO stage data returned by procurement service."} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 12, right: 18, left: 20, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} width={90} />
        <Tooltip />
        <Bar dataKey="hours" fill="var(--accent-amber)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
