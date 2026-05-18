"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardData, EmptyDashboardState } from "../DashboardDataContext";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="min-w-[200px] rounded border p-3 shadow-lg" style={{ backgroundColor: "#1A3A5C", borderColor: data.accuracy < 99 ? "var(--accent-red)" : "var(--accent-teal)" }}>
      <p className="mb-2 text-[12px] font-bold text-white">{label}</p>
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Accuracy</span><span className="font-bold text-white">{data.accuracy}%</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Variance</span><span className="font-bold text-white">{data.variancePct}%</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>System Cnt</span><span className="font-bold text-white">{data.systemCount}</span></div>
        <div className="flex flex-col"><span style={{ color: "var(--text-secondary)" }}>Actual Cnt</span><span className="font-bold text-white">{data.actualCount}</span></div>
      </div>
    </div>
  );
};

export default function CycleCountAccuracyTrend() {
  const { data, isLoading } = useDashboardData();
  const chartData = data?.operations?.cycleCountAccuracyTrend || [];

  if (!chartData.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend cycle count data..." : "No cycle count accuracy source is available from the current microservices."} />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={{ stroke: "var(--border-subtle)" }} />
        <YAxis yAxisId="left" domain={[95, 100.5]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="right" orientation="right" domain={[0, "dataMax + 10"]} tick={{ fontSize: 10, fill: "var(--text-secondary)", fontFamily: "var(--font-label)" }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine yAxisId="left" y={99} stroke="var(--accent-green)" strokeDasharray="3 3" strokeWidth={2} />
        <Bar yAxisId="right" dataKey="discrepancyCount">
          {chartData.map((entry) => (
            <Cell key={entry.week} fill={entry.accuracy < 99 ? "var(--accent-red)" : "var(--accent-amber)"} fillOpacity={entry.accuracy < 99 ? 0.8 : 0.6} />
          ))}
        </Bar>
        <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="var(--accent-teal)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "var(--accent-teal)" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
