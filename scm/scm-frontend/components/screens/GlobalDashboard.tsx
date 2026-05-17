import MasterDashboardLayout from '../dashboard/DashboardLayout';
import DashboardGrid from '../dashboard/DashboardGrid';
import { 
  TrendingUp,
  TrendingDown, 
  DollarSign, 
  Package, 
  CheckCircle,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useEffect, useState, useMemo } from "react";
import { fetchInventoryItems } from "@/lib/inventoryService";
import { fetchDistributionInventoryValueTotal, fetchDistributionOrders } from "@/lib/distributionService";
import { fetchPurchaseOrders } from "@/lib/procurementService";
import { fetchBackendHealth, type BackendHealthResponse } from "@/lib/backend-api";
import {
  fetchCurrentMonthlyBudget,
  fetchCustomsDelays as fetchCustomsDelayRows,
} from "@/lib/procurementService";

import { supabaseFulfillment } from "@/lib/supabase";

// supplyChainSteps removed

// inventoryData removed

// statCards removed

export function GlobalDashboard() {
  const [realInventory, setRealInventory] = useState([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [orders, setOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [backordersCount, setBackordersCount] = useState(0);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [inv, assets, distOrders, poData, backordersRes] = await Promise.all([
          fetchInventoryItems(),
          fetchDistributionInventoryValueTotal(),
          fetchDistributionOrders(),
          fetchPurchaseOrders(),
          supabaseFulfillment.from("v_backorder_aging").select("*", { count: 'exact', head: true })
        ]);
        setRealInventory(inv || []);
        setTotalAssets(assets || 0);
        setOrders(distOrders || []);
        setPurchaseOrders(poData || []);
        setBackordersCount(backordersRes.count || 0);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };
    loadDashboardData();

    // Subscribe to backorder changes for real-time updates
    const channel = supabaseFulfillment
      .channel("dashboard-real-time")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "backorders" },
        () => loadDashboardData()
      )
      .subscribe();

    return () => {
      void supabaseFulfillment.removeChannel(channel);
    };
  }, []);

  const pendingPaymentsValue = useMemo(() => 
    orders
      .filter(o => o.status === "placed" || o.status === "partially_fulfilled")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  , [orders]);

  const overdueCount = useMemo(() => 
    orders
      .filter(o => o.status !== "fulfilled" && o.status !== "cancelled" && o.due_date && new Date(o.due_date) < new Date())
      .length
  , [orders]);

  const inTransitCount = useMemo(() => 
    purchaseOrders.filter(po => po.status === "In-Transit").length
  , [purchaseOrders]);

  const lowStockCount = useMemo(() => 
    realInventory.filter(item => item.status === "low" || item.status === "zero").length
  , [realInventory]);

  const inventoryChartData = useMemo(() => 
    realInventory.map(item => ({
      sku: item.sku,
      units: item.systemCount,
      value: item.systemCount * 50, // Mock unit value for chart if not available
      status: (item.status === "low" || item.status === "zero") ? "low" : "healthy"
    })).slice(0, 10)
  , [realInventory]);

  const formatPHP = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);

  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [spentAmount, setSpentAmount] = useState(0);
  const [customsDelays, setCustomsDelays] = useState<any[]>([]);
  const [customsLoading, setCustomsLoading] = useState(false);
  const [backendHealth, setBackendHealth] =
    useState<BackendHealthResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMonthlyBudget = async () => {
      try {
        const data = await fetchCurrentMonthlyBudget();
        if (data) {
          setAllocatedAmount(data.allocated_amount || 0);
          setSpentAmount(data.spent_amount || 0);
        }
      } catch {
        setAllocatedAmount(0);
        setSpentAmount(0);
      }
    };

    const fetchCustomsDelays = async () => {
      setCustomsLoading(true);
      try {
        const data = await fetchCustomsDelayRows();
        setCustomsDelays(data);
      } catch {
        setCustomsDelays([]);
      } finally {
        setCustomsLoading(false);
      }
    };

    const loadBackendHealth = async () => {
      try {
        const data = await fetchBackendHealth();
        setBackendHealth(data);
        setBackendError(null);
      } catch (error) {
        setBackendHealth(null);
        setBackendError(
          error instanceof Error ? error.message : "Backend unavailable",
        );
      }
    };

    void fetchMonthlyBudget();
    void fetchCustomsDelays();
    void loadBackendHealth();
  }, []);

    const budgetUsedPercent =
    allocatedAmount > 0 ? (spentAmount / allocatedAmount) * 100 : 0;

    let budgetStatus = "Safe";
    let budgetStatusColor = "text-green-600";
    
    if (budgetUsedPercent >= 90) {
      budgetStatus = "Critical";
      budgetStatusColor = "text-red-600";
    } else if (budgetUsedPercent >= 80) {
      budgetStatus = "Warning";
      budgetStatusColor = "text-yellow-600";
    }

  const budgetBarColor =
    budgetUsedPercent >= 90
      ? "bg-red-600"
      : budgetUsedPercent >= 80
        ? "bg-yellow-500"
        : "bg-green-500";
  

  const supplyChainSteps = useMemo(() => [
    { id: 1, label: "P.O. Created", status: purchaseOrders.length > 0 ? "complete" : "pending", count: purchaseOrders.length },
    { id: 2, label: "Supplier Confirmed", status: purchaseOrders.some(po => po.status === "Confirmed") ? "complete" : "pending", count: purchaseOrders.filter(po => po.status === "Confirmed").length },
    { id: 3, label: "In-Transit: Air/Sea", status: purchaseOrders.some(po => po.status === "In-Transit") ? "active" : "pending", count: purchaseOrders.filter(po => po.status === "In-Transit").length },
    { id: 4, label: "Receiving", status: purchaseOrders.some(po => po.status === "Receiving") ? "pending" : "pending", count: purchaseOrders.filter(po => po.status === "Receiving").length },
    { id: 5, label: "Local Dispatch", status: orders.some(o => o.status === "partially_fulfilled") ? "pending" : "pending", count: orders.filter(o => o.status === "partially_fulfilled").length },
    { id: 6, label: "Retailer Received", status: orders.some(o => o.status === "fulfilled") ? "pending" : "pending", count: orders.filter(o => o.status === "fulfilled").length },
    { id: 7, label: "Payment Settled", status: "pending", count: 0 },
  ], [purchaseOrders, orders]);


  return (
    <div className="h-full w-full flex flex-col">
      <MasterDashboardLayout>
        <DashboardGrid />
      </MasterDashboardLayout>
    </div>
  );
}