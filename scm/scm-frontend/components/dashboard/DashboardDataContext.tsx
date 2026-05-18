"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { fetchDashboardAnalytics, type DashboardAnalyticsData } from "@/lib/dashboardAnalyticsService";
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

  const refetch = async () => {
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
  };

  useEffect(() => {
    void refetch();
  }, [dateRange]);

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
