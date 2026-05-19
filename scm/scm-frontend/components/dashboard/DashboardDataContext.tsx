"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchDashboardAnalytics, type DashboardAnalyticsData } from "@/lib/dashboardAnalyticsService";
import { subscribeToDashboardInvalidation } from "@/lib/dashboardInvalidation";
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
  const refreshTimerRef = useRef<number | null>(null);
  const followUpRefreshTimerRef = useRef<number | null>(null);

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

  const scheduleRefetch = useCallback(
    (delayMs = 300) => {
      if (typeof window === "undefined") {
        return;
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refetch();
      }, delayMs);
    },
    [refetch],
  );

  const scheduleRefetchBurst = useCallback(
    (initialDelayMs = 250, followUpDelayMs = 2200) => {
      scheduleRefetch(initialDelayMs);

      if (typeof window === "undefined") {
        return;
      }

      if (followUpRefreshTimerRef.current) {
        window.clearTimeout(followUpRefreshTimerRef.current);
      }

      followUpRefreshTimerRef.current = window.setTimeout(() => {
        followUpRefreshTimerRef.current = null;
        void refetch();
      }, followUpDelayMs);
    },
    [refetch, scheduleRefetch],
  );

  useEffect(() => {
    void refetch();
  }, [dateRange, refetch]);

  useEffect(() => {
    const refetchWhenVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleRefetch(500);
      }
    };

    const interval = window.setInterval(refetchWhenVisible, 5000);
    window.addEventListener("focus", refetchWhenVisible);
    document.addEventListener("visibilitychange", refetchWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refetchWhenVisible);
      document.removeEventListener("visibilitychange", refetchWhenVisible);
    };
  }, [scheduleRefetch]);

  useEffect(() => {
    const scheduleDashboardRefresh = () => {
      scheduleRefetchBurst(400, 2400);
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
      void supabaseSCM.removeChannel(scmChannel);
      void supabaseFulfillment.removeChannel(fulfillmentChannel);
      void supabaseQuality.removeChannel(qualityChannel);
    };
  }, [scheduleRefetchBurst]);

  useEffect(() => {
    return subscribeToDashboardInvalidation(() => {
      scheduleRefetchBurst(150, 1800);
    });
  }, [scheduleRefetchBurst]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (followUpRefreshTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(followUpRefreshTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch,
    }),
    [data, isLoading, error, refetch],
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
