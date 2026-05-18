"use client";

import { ReactNode } from "react";
import Header from "./Header";
import KPIScorecardBar from "./KPIScorecardBar";
import { useDashboardStore } from "@/store/dashboardStore";
import { DashboardDataProvider } from "./DashboardDataContext";

export default function MasterDashboardLayout({ children }: { children: ReactNode }) {
  const { activeRole } = useDashboardStore();

  return (
    <DashboardDataProvider>
      <div className="flex flex-col flex-1 min-w-0 w-full relative h-full" style={{ backgroundColor: 'var(--bg-base)' }} id="dashboard-main-content">
        <Header />
        
        <main className="flex-1 overflow-auto flex flex-col">
          <KPIScorecardBar />
          
          <div className="flex-1 p-4 overflow-y-auto">
            {/* The main grid view injected via children based on activeRole */}
            {children}
          </div>
        </main>
      </div>
    </DashboardDataProvider>
  );
}
