"use client";

import { EmptyDashboardState, useDashboardData } from "../DashboardDataContext";

export default function InboundGRNPipeline() {
  const { data, isLoading } = useDashboardData();
  const stages = data?.operations?.transferVelocityFunnel || [];

  if (!stages.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend inbound pipeline..." : "No inbound pipeline records returned by procurement service."} />;
  }

  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 overflow-hidden">
      {stages.map((stage) => (
        <div key={stage.stage} className="grid grid-cols-[96px_1fr_44px] items-center gap-3">
          <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-label)" }}>
            {stage.stage}
          </div>
          <div className="h-5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-elevated)" }}>
            <div
              className="flex h-full items-center justify-end rounded-full px-2 text-[9px] font-bold text-white"
              style={{
                width: `${Math.max(8, (stage.count / maxCount) * 100)}%`,
                backgroundColor: stage.avgHoursInStage >= 12 ? "var(--accent-amber)" : "var(--accent-teal)",
              }}
            >
              {stage.avgHoursInStage > 0 ? `${stage.avgHoursInStage.toFixed(1)}h` : ""}
            </div>
          </div>
          <div className="text-right font-mono text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{stage.count}</div>
        </div>
      ))}
    </div>
  );
}
