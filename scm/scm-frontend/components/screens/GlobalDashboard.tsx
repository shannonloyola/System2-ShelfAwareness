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
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      {/* Header */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
          Global Command Dashboard
        </h1>
        <p className="text-[#6B7280]">Real-time overview of your pharmaceutical supply chain</p>
      </div>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardContent className="flex flex-col gap-2 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">
              Backend API Status
            </p>
            <p className="text-sm text-[#6B7280]">
              Frontend is configured to call the Nest.js backend API layer.
            </p>
          </div>
          <div className="text-sm">
            {backendHealth ? (
              <div className="flex flex-col items-start gap-1 lg:items-end">
                <span className="inline-flex rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#166534]">
                  {backendHealth.status.toUpperCase()}
                </span>
                <span className="text-[#6B7280]">
                  {backendHealth.framework} at {backendHealth.service}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-1 lg:items-end">
                <span className="inline-flex rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-semibold text-[#991B1B]">
                  UNREACHABLE
                </span>
                <span className="text-[#6B7280]">
                  {backendError ??
                    "Start the Nest backend on port 3001"}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Total Assets</CardTitle>
              <DollarSign className="w-5 h-5 text-[#00A3AD]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">{formatPHP(totalAssets)}</div>
              <p className="text-xs font-medium text-[#00A3AD]">Live inventory valuation</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Shipments from Japan</CardTitle>
              <Package className="w-5 h-5 text-[#00A3AD]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">{inTransitCount} Active</div>
              <p className="text-xs font-medium text-[#00A3AD]">In-Transit status</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Pending Backorders</CardTitle>
              <AlertCircle className="w-5 h-5 text-[#F97316]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">{backordersCount}</div>
              <p className="text-xs font-medium text-[#F97316]">Retailer waitlist</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Low Stock SKUs</CardTitle>
              <TrendingDown className="w-5 h-5 text-[#DC2626]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">{lowStockCount}</div>
              <p className="text-xs font-medium text-[#DC2626]">Replenishment required</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">Payments Pending</CardTitle>
              <DollarSign className="w-5 h-5 text-[#F97316]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">{formatPHP(pendingPaymentsValue)}</div>
              <p className="text-xs font-medium text-[#F97316]">{overdueCount} Overdue</p>
            </CardContent>
          </Card>
      </div>
      
      {/* Monthly Procurement Budget */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Monthly Procurement Budget
          </CardTitle>
          <p className="text-sm text-[#6B7280]">
            Track current procurement spending against monthly allocation
          </p>
        </CardHeader>
      
        <CardContent>
          <div className="flex justify-between mb-2 text-sm text-[#6B7280]">
            <span>₱{spentAmount.toLocaleString()}</span>
            <span>₱{allocatedAmount.toLocaleString()}</span>
          </div>
      
          <div className="w-full bg-[#E5E7EB] rounded-full h-4">
            <div
              className={`${budgetBarColor} h-4 rounded-full transition-all`}
              style={{ width: `${Math.min(budgetUsedPercent, 100)}%` }}
            />
          </div>
      
          <div className="flex justify-between items-center mt-2 text-xs">
          <span className="text-[#6B7280]">
            {budgetUsedPercent.toFixed(1)}% of monthly procurement budget used
          </span>
        
          <span className={`font-semibold ${budgetStatusColor}`}>
            {budgetStatus}
          </span>
        </div>
        </CardContent>
      </Card>
      
      {/* Critical Alerts - Customs Delays */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#111827] font-semibold flex items-center gap-2">
                Critical Alerts
                {customsDelays.length > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                    Red Tape
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-[#6B7280] mt-1">
                Red Tape delays at Port Customs (over 5 days)
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {customsLoading ? (
            <div className="text-center py-8 text-[#6B7280]">Loading...</div>
          ) : customsDelays.length === 0 ? (
            <div className="text-center py-8 text-[#6B7280]">
              No customs delays detected.
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="font-semibold text-[#111827]">
                  {customsDelays.length} delayed shipment{customsDelays.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              <div className="space-y-3">
                {customsDelays.slice(0, 5).map((delay) => (
                  <div
                    key={delay.po_id}
                    className="p-4 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-[#111827] mb-1">
                          {delay.po_no}
                        </p>
                        <p className="text-sm text-[#6B7280]">
                          {delay.supplier_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-600 font-medium">
                          Entry: {new Date(delay.customs_entry_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Supply Chain Tracker */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Interactive Supply Chain Tracker
          </CardTitle>
          <p className="text-sm text-[#6B7280]">Track orders from Japan to local retailers in real-time</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto pb-4">
            <div className="flex items-center gap-2 min-w-max">
              {supplyChainSteps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-32 h-24 rounded-lg flex flex-col items-center justify-center transition-all ${
                        step.status === "complete"
                          ? "bg-[#00A3AD] text-white shadow-lg"
                          : step.status === "active"
                          ? "bg-[#00A3AD] text-white shadow-xl ring-4 ring-[#00A3AD]/30"
                          : "bg-[#E5E7EB] text-[#6B7280]"
                      }`}
                    >
                      <div className="text-2xl font-bold mb-1">{step.count}</div>
                      <div className="text-xs text-center px-2 font-medium">{step.label}</div>
                    </div>
                  </div>
                  {index < supplyChainSteps.length - 1 && (
                    <ArrowRight 
                      className={`w-6 h-6 mx-2 ${
                        step.status === "complete" ? "text-[#00A3AD]" : "text-[#D1D5DB]"
                      }`} 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BA/Analytics Module */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Inventory Stack-up Analysis
          </CardTitle>
          <p className="text-sm text-[#6B7280]">Click on bars to drill down into specific SKUs</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={inventoryChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="sku" 
                angle={-45}
                textAnchor="end"
                height={100}
                style={{ fontSize: '12px', fill: '#6B7280', fontFamily: 'Inter, sans-serif' }}
              />
              <YAxis style={{ fontSize: '12px', fill: '#6B7280', fontFamily: 'Inter, sans-serif' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Bar dataKey="units" radius={[8, 8, 0, 0]}>
                {inventoryChartData.map((entry) => (
                  <Cell 
                    key={`cell-${entry.sku}`} 
                    fill={entry.status === 'low' ? '#D1D5DB' : '#1A2B47'} 
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Inventory Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">SKU</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#6B7280]">Units</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#6B7280]">Value</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#6B7280]">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryChartData.map((item) => (
                  <tr key={item.sku} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 text-[#111827] font-medium">{item.sku}</td>
                    <td className="py-3 px-4 text-right text-[#111827]">{item.units.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-[#111827]">₱{item.value.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === "low"
                            ? "bg-[#F97316] text-white"
                            : "bg-[#00A3AD] text-white"
                        }`}
                      >
                        {item.status === "low" ? "Low Stock" : "Healthy"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
