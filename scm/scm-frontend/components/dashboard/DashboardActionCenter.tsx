"use client";

import { AlertTriangle, ArrowRight, ClipboardList, PackageCheck, ShieldAlert } from "lucide-react";
import { DashboardRole } from "@/store/dashboardStore";
import { EmptyDashboardState, useDashboardData } from "./DashboardDataContext";
import type { DashboardAnalyticsData } from "@/lib/dashboardAnalyticsService";

type ActionItem = {
  title: string;
  owner: string;
  impact: string;
  action: string;
  href: string;
  priority: "critical" | "warning" | "watch";
};

const PRIORITY_STYLES = {
  critical: {
    label: "Immediate",
    icon: AlertTriangle,
    color: "var(--accent-red)",
    bg: "rgba(239, 68, 68, 0.08)",
    border: "rgba(239, 68, 68, 0.18)",
  },
  warning: {
    label: "Next",
    icon: ShieldAlert,
    color: "var(--accent-amber)",
    bg: "rgba(245, 158, 11, 0.08)",
    border: "rgba(245, 158, 11, 0.18)",
  },
  watch: {
    label: "Monitor",
    icon: ClipboardList,
    color: "var(--accent-teal)",
    bg: "rgba(0, 163, 173, 0.08)",
    border: "rgba(0, 163, 173, 0.18)",
  },
} as const;

const formatPhp = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

const buildActions = (role: DashboardRole, data: DashboardAnalyticsData | null): ActionItem[] => {
  if (!data) return [];

  const criticalSku = data.executive.criticalStockProducts[0];
  const topExposure = data.executive.topExposureProducts[0];
  const budget = data.executive.budgetPosition;
  const oldestBackorder = [...data.operations.backorderAging].sort((a, b) => b.avgDaysWaiting - a.avgDaysWaiting)[0];
  const bottleneck = [...data.operations.transferVelocityFunnel].sort((a, b) => b.avgHoursInStage - a.avgHoursInStage)[0];
  const pendingTransfers = data.kpis.Operations.find((item) => item.label === "Pending Transfers")?.value || "0";

  if (role === "Executive") {
    return [
      criticalSku && {
        title: "Issue reorder trigger",
        owner: "Procurement",
        impact: `${criticalSku.name} is the most urgent backend-ranked stock risk.`,
        action: `Create or review purchase coverage for ${criticalSku.sku}; current stock is ${criticalSku.stockLevel} ${criticalSku.daysOfCover != null ? `with ${criticalSku.daysOfCover.toFixed(1)} days cover` : "with no movement cover available"}.`,
        href: "/procurement",
        priority: "critical" as const,
      },
      topExposure && {
        title: "Review exposure concentration",
        owner: "Inventory Control",
        impact: `${topExposure.name} is the highest inventory exposure at ${formatPhp(topExposure.exposure)}.`,
        action: `Validate stock count and replenishment plan for ${topExposure.sku} before approving additional spend.`,
        href: "/stock",
        priority: "watch" as const,
      },
      budget?.allocated > 0 && {
        title: budget.usedPct > 90 ? "Control budget pressure" : "Monitor budget headroom",
        owner: "Finance + Procurement",
        impact: `${budget.usedPct.toFixed(1)}% of current allocation is spent or committed.`,
        action: `Use the remaining ${formatPhp(budget.remaining)} allocation for critical stock only until the next review.`,
        href: "/po-list",
        priority: budget.usedPct > 90 ? "critical" as const : "warning" as const,
      },
    ].filter(Boolean) as ActionItem[];
  }

  if (role === "Operations") {
    return [
      bottleneck && {
        title: "Clear process bottleneck",
        owner: "Warehouse Lead",
        impact: `${bottleneck.stage} has the highest average queue time at ${bottleneck.avgHoursInStage.toFixed(1)} hours.`,
        action: `Prioritize the ${bottleneck.count} records currently sitting in ${bottleneck.stage}.`,
        href: "/warehouse",
        priority: bottleneck.avgHoursInStage >= 12 ? "critical" as const : "warning" as const,
      },
      oldestBackorder && oldestBackorder.count > 0 && {
        title: "Resolve aged backorders",
        owner: "Distribution",
        impact: `${oldestBackorder.count} backorders are in the ${oldestBackorder.bucket} bucket.`,
        action: `Work the ${oldestBackorder.bucket} bucket first, then validate substitutions for unresolved SKUs.`,
        href: "/distribution",
        priority: oldestBackorder.bucket.includes("30") ? "critical" as const : "warning" as const,
      },
      {
        title: "Review open transfer queue",
        owner: "Inventory Control",
        impact: `${pendingTransfers} pending transfer records are currently reflected by procurement/inventory services.`,
        action: "Use the stock movement feed to clear the oldest queue entries before processing new movement.",
        href: "/stock",
        priority: "watch" as const,
      },
    ];
  }

  return [
    {
      title: "Review open purchase orders",
      owner: "Procurement",
      impact: `${data.kpis.Procurement[0]?.value || "0"} open POs are currently returned by procurement service.`,
      action: "Prioritize POs tied to critical stock products and high exposure SKUs.",
      href: "/po-list",
      priority: "warning",
    },
    criticalSku && {
      title: "Source critical SKU",
      owner: "Vendor Management",
      impact: `${criticalSku.name} is the top reorder candidate from inventory service.`,
      action: `Check supplier availability and create coverage for ${criticalSku.sku}.`,
      href: "/procurement",
      priority: "critical" as const,
    },
  ].filter(Boolean) as ActionItem[];
};

export default function DashboardActionCenter({ role }: { role: DashboardRole }) {
  const { data, isLoading } = useDashboardData();
  const actions = buildActions(role, data).slice(0, 3);

  if (!actions.length) {
    return <EmptyDashboardState message={isLoading ? "Loading backend action signals..." : "No actionable backend signals available."} />;
  }

  return (
    <div className="flex h-full w-full flex-col gap-3 p-2">
      <div className="flex items-start justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="space-y-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent-teal)", fontFamily: "var(--font-label)" }}
          >
            Prescriptive layer
          </div>
          <p className="text-[13px] leading-5" style={{ color: "var(--text-primary)" }}>
            Ranked actions anchored on the current dashboard signals so the last thing the user sees is what to do next.
          </p>
        </div>
        <div
          className="hidden rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] md:flex"
          style={{
            color: "var(--accent-teal)",
            borderColor: "rgba(0, 163, 173, 0.18)",
            backgroundColor: "rgba(0, 163, 173, 0.06)",
            fontFamily: "var(--font-label)",
          }}
        >
          Ranked by urgency and business impact
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {actions.map((item) => {
          const style = PRIORITY_STYLES[item.priority];
          const PriorityIcon = style.icon;

          return (
            <div
              key={item.title}
              className="flex h-full flex-col justify-between rounded-lg border p-4"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: style.border,
                boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: style.color, backgroundColor: style.bg, fontFamily: "var(--font-label)" }}
                  >
                    <PriorityIcon className="h-3.5 w-3.5" />
                    {style.label}
                  </div>
                  <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    <PackageCheck className="h-3.5 w-3.5" />
                    <span>{item.owner}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[13px] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </h4>
                  <p className="text-[11px] leading-5" style={{ color: "var(--text-secondary)" }}>
                    {item.impact}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-[11px] leading-5" style={{ color: "var(--text-primary)" }}>
                  {item.action}
                </p>
                <a
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: "var(--accent-teal)" }}
                >
                  Open work queue
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
