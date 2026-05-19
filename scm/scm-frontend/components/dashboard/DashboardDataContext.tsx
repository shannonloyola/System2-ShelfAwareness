"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchDashboardAnalytics, type DashboardAnalyticsData } from "@/lib/dashboardAnalyticsService";
import { supabaseFulfillment, supabaseQuality, supabaseSCM } from "@/lib/supabase";
import { useDashboardStore } from "@/store/dashboardStore";

type DashboardDataContextValue = {
  data: DashboardAnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const dateRange = useDashboardStore((state) => state.dateRange);
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchDashboardAnalytics();
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load dashboard data");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [dateRange, refetch]);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refetch();
      }, 500);
    };

    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };

    const interval = window.setInterval(refetchWhenVisible, 15000);
    window.addEventListener("focus", refetchWhenVisible);
    document.addEventListener("visibilitychange", refetchWhenVisible);

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      window.clearInterval(interval);
      window.removeEventListener("focus", refetchWhenVisible);
      document.removeEventListener("visibilitychange", refetchWhenVisible);
    };
  }, [refetch]);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const scheduleDashboardRefresh = () => {
      if (document.visibilityState !== "visible") return;

      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refetch();
      }, 750);
    };

    const watchTables = (
      channel: ReturnType<typeof supabaseSCM.channel>,
      tables: string[],
    ) => {
      tables.forEach((table) => {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleDashboardRefresh,
        );
      });

      return channel.subscribe();
    };

    const scmChannel = watchTables(
      supabaseSCM.channel("dashboard-scm-data-changes"),
      [
        "products",
        "product_pricing",
        "suppliers",
        "supplier_scorecard_cache",
        "purchase_orders",
        "purchase_order_items",
        "po_status_history",
        "freight_quotes",
        "monthly_budgets",
      ],
    );

    const fulfillmentChannel = watchTables(
      supabaseFulfillment.channel("dashboard-fulfillment-data-changes"),
      [
        "inventory_on_hand",
        "backorders",
        "backorder_alerts",
        "retail_orders",
        "retail_order_lines",
        "payments",
      ],
    );

    const qualityChannel = watchTables(
      supabaseQuality.channel("dashboard-quality-data-changes"),
      ["shipment_discrepancies"],
    );

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      void supabaseSCM.removeChannel(scmChannel);
      void supabaseFulfillment.removeChannel(fulfillmentChannel);
      void supabaseQuality.removeChannel(qualityChannel);
    };
  }, [refetch]);

  const value = useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch,
    }),
    [data, isLoading, error],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error("useDashboardData must be used inside DashboardDataProvider");
  }
  return value;
}

export function EmptyDashboardState({ message = "No backend data available." }: { message?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed px-4 text-center text-[11px]" style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
      {message}
    </div>
  );
}
