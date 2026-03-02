// src/app/App.tsx
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router";
import { Toaster } from "./components/ui/sonner";
import { DashboardLayout } from "./components/DashboardLayout";
import { LoginScreen } from "./components/screens/LoginScreen";
import { GlobalDashboard } from "./components/screens/GlobalDashboard";
import { ProductMaster } from "./components/screens/ProductMaster";
import { InboundProcurement } from "./components/screens/InboundProcurement";
import { WarehouseReceiving } from "./components/screens/WarehouseReceiving";
import { StockManagement } from "./components/screens/StockManagement";
import { OutboundDistribution } from "./components/screens/OutboundDistribution";
import { DiscrepancyApprovals } from "./components/screens/DiscrepancyApprovals";
import { PODetailPage, POList } from "./components/screens/POlist";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <>
              <LoginScreen />
              <Toaster />
            </>
          }
        />
        <Route
          path="/*"
          element={
            <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>
              <DashboardLayout>
                <Routes>
                  <Route path="dashboard" element={<GlobalDashboard />} />
                  <Route path="products" element={<ProductMaster />} />
                  <Route path="procurement" element={<InboundProcurement />} />
                  <Route path="po-list" element={<POList />} />
                  <Route path="po-list/:poId" element={<PODetailPage />} />
                  <Route path="warehouse" element={<WarehouseReceiving />} />
                  <Route path="stock" element={<StockManagement />} />
                  <Route path="distribution" element={<OutboundDistribution />} />
                  <Route path="discrepancies" element={<DiscrepancyApprovals />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
              </DashboardLayout>
              <Toaster />
            </div>
          }
        />
      </Routes>
    </HashRouter>
  );
}
