import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  CheckCircle,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchBackendHealth, type BackendHealthResponse } from "@/lib/backend-api";

const supplyChainSteps = [
  { id: 1, label: "P.O. Created", status: "complete", count: 12 },
  { id: 2, label: "Supplier Confirmed (JP)", status: "complete", count: 12 },
  { id: 3, label: "In-Transit: Air/Sea", status: "active", count: 8 },
  { id: 4, label: "Receiving", status: "pending", count: 4 },
  { id: 5, label: "Local Dispatch", status: "pending", count: 2 },
  { id: 6, label: "Retailer Received", status: "pending", count: 0 },
  { id: 7, label: "Payment Settled", status: "pending", count: 0 },
];

const inventoryData = [
  { sku: "Amoxicillin 500mg", units: 12500, value: 625000, status: "healthy" },
  { sku: "Paracetamol 500mg", units: 18200, value: 364000, status: "healthy" },
  { sku: "Ibuprofen 400mg", units: 8900, value: 445000, status: "healthy" },
  { sku: "Cetirizine 10mg", units: 3200, value: 192000, status: "low" },
  { sku: "Losartan 50mg", units: 6700, value: 536000, status: "healthy" },
  { sku: "Metformin 500mg", units: 1800, value: 144000, status: "low" },
];

const statCards = [
  {
    title: "Total Assets",
    value: "₱2.3M",
    change: "+12.5%",
    icon: DollarSign,
    color: "#00A3AD"
  },
  {
    title: "Payments Pending",
    value: "₱485K",
    change: "3 Overdue",
    icon: AlertCircle,
    color: "#F97316"
  },
  {
    title: "Shipments from Japan",
    value: "8 Active",
    change: "ETA: 3-7 days",
    icon: Package,
    color: "#00A3AD"
  },
  {
    title: "Fulfillment Rate",
    value: "94.2%",
    change: "+2.1%",
    icon: CheckCircle,
    color: "#00A3AD"
  },
];

export function GlobalDashboard() {
  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [spentAmount, setSpentAmount] = useState(0);
  const [customsDelays, setCustomsDelays] = useState<any[]>([]);
  const [customsLoading, setCustomsLoading] = useState(false);
  const [backendHealth, setBackendHealth] =
    useState<BackendHealthResponse | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
  const fetchMonthlyBudget = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data, error } = await supabase
      .from("monthly_budgets")
      .select("allocated_amount, spent_amount")
      .eq("month", month)
      .eq("year", year)
      .single();

    if (!error && data) {
      setAllocatedAmount(data.allocated_amount || 0);
      setSpentAmount(data.spent_amount || 0);
    }
  };

  const fetchCustomsDelays = async () => {
    setCustomsLoading(true);
    const { data, error } = await supabase
      .from("stuck_at_customs_view")
      .select("po_id, po_no, supplier_name, customs_entry_date, transit_status")
      .order("customs_entry_date", { ascending: true });

    if (!error && data) {
      setCustomsDelays(data);
    }
    setCustomsLoading(false);
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

  fetchMonthlyBudget();
  fetchCustomsDelays();
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="bg-white border-[#111827]/10 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#6B7280]">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1 text-[#111827]">
                {stat.value}
              </div>
              <p className="text-xs font-medium" style={{ color: stat.color }}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
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
            <BarChart data={inventoryData}>
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
                {inventoryData.map((entry) => (
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
                {inventoryData.map((item) => (
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
