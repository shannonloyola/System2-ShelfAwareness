import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useState, useEffect } from "react";
import { 
  Plus, 
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface RetailerOrder {
  id: string;
  orderNumber: string;
  retailer: string;
  date: string;
  items: number;
  total: number;
  paymentStatus: "paid" | "pending" | "delayed" | "partial";
  paymentTerms: string;
  dueDate: string;
  channel: "viber" | "whatsapp" | "email";
}

const mockOrders: RetailerOrder[] = [
  {
    id: "1",
    orderNumber: "ORD-2026-0145",
    retailer: "Watsons - SM Mall of Asia",
    date: "2026-02-10",
    items: 24,
    total: 485000,
    paymentStatus: "paid",
    paymentTerms: "30-day",
    dueDate: "2026-03-12",
    channel: "viber"
  },
  {
    id: "2",
    orderNumber: "ORD-2026-0146",
    retailer: "Mercury Drug - Makati",
    date: "2026-02-15",
    items: 18,
    total: 325000,
    paymentStatus: "pending",
    paymentTerms: "60-day",
    dueDate: "2026-04-16",
    channel: "whatsapp"
  },
  {
    id: "3",
    orderNumber: "ORD-2026-0147",
    retailer: "Watsons - Bonifacio Global City",
    date: "2026-01-20",
    items: 32,
    total: 628000,
    paymentStatus: "delayed",
    paymentTerms: "30-day",
    dueDate: "2026-02-19",
    channel: "viber"
  },
  {
    id: "4",
    orderNumber: "ORD-2026-0148",
    retailer: "Mercury Drug - Quezon City",
    date: "2026-02-05",
    items: 15,
    total: 298000,
    paymentStatus: "partial",
    paymentTerms: "Installments",
    dueDate: "2026-03-05",
    channel: "email"
  },
  {
    id: "5",
    orderNumber: "ORD-2026-0149",
    retailer: "Southstar Drug - Manila",
    date: "2026-02-18",
    items: 12,
    total: 185000,
    paymentStatus: "pending",
    paymentTerms: "30-day",
    dueDate: "2026-03-20",
    channel: "whatsapp"
  },
];

const retailerPerformance = [
  { name: "Watsons", paid: 1250000, pending: 325000, status: "healthy" },
  { name: "Mercury Drug", paid: 980000, pending: 485000, status: "healthy" },
  { name: "Southstar Drug", paid: 450000, pending: 185000, status: "healthy" },
  { name: "The Generics Pharmacy", paid: 280000, pending: 620000, status: "attention" },
];

export function OutboundDistribution() {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [totalInventoryValue, setTotalInventoryValue] = useState<number | null>(null);
  const [inventoryValueByCategory, setInventoryValueByCategory] = useState<
    Array<{ category_name: string; total_value_php: number }>
  >([]);
  const totalCategoryValue = inventoryValueByCategory.reduce(
    (sum, cat) => sum + Number(cat.total_value_php ?? 0),
    0,
  );

  const formatPHP = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  // Fetch Total Inventory Value
  useEffect(() => {
    const fetchTotalInventoryValue = async () => {
      try {
        const url = `https://${projectId}.supabase.co/rest/v1/v_total_inventory_value_php?select=total_inventory_value_php`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0 && data[0].total_inventory_value_php !== null) {
            setTotalInventoryValue(data[0].total_inventory_value_php);
          }
        } else {
          console.error("Failed to fetch total inventory value:", await response.text());
        }
      } catch (error) {
        console.error("Failed to fetch total inventory value:", error);
      }
    };

    fetchTotalInventoryValue();
  }, []);

  // Fetch Inventory Value by Category
  useEffect(() => {
    const fetchInventoryValueByCategory = async () => {
      try {
        const url = `https://${projectId}.supabase.co/rest/v1/v_inventory_value_by_category_php?select=category_name,total_value_php&order=total_value_php.desc`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setInventoryValueByCategory(data || []);
        } else {
          console.error("Failed to fetch inventory value by category:", await response.text());
        }
      } catch (error) {
        console.error("Failed to fetch inventory value by category:", error);
      }
    };

    fetchInventoryValueByCategory();
  }, []);

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-[#00A3AD] text-white";
      case "pending": return "bg-[#D1D5DB] text-[#111827]";
      case "delayed": return "bg-[#F97316] text-white";
      case "partial": return "bg-[#F97316]/70 text-white";
      default: return "bg-[#E5E7EB] text-[#111827]";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "paid": return <CheckCircle className="w-4 h-4" />;
      case "pending": return <Clock className="w-4 h-4" />;
      case "delayed": return <AlertCircle className="w-4 h-4" />;
      case "partial": return <DollarSign className="w-4 h-4" />;
      default: return null;
    }
  };

  const handleLogOrder = () => {
    toast.success("Order Logged", {
      description: "Order has been added to the system"
    });
    setShowOrderForm(false);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Outbound Distribution & Retail Sales
          </h1>
          <p className="text-[#6B7280]">Manage retail orders and track payments</p>
        </div>
        <Button
          onClick={() => setShowOrderForm(!showOrderForm)}
          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Order
        </Button>
      </div>

      {/* Payment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Inventory Value (PHP) - NEW KPI */}
        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Total Inventory Value (PHP)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1 text-[#1A2B47]">
              {totalInventoryValue !== null
                ? formatPHP(Number(totalInventoryValue))
                : "Loading..."}
            </div>
            <p className="text-xs text-[#6B7280]">Current stock value</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1 text-[#F97316]">
              ₱1.6M
            </div>
            <p className="text-xs text-[#6B7280]">Across 8 retailers</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Collected (Feb)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1 text-[#00A3AD]">
              ₱2.9M
            </div>
            <p className="text-xs font-medium text-[#00A3AD]">+18% vs last month</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#6B7280]">Overdue Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1 text-[#F97316]">
              3
            </div>
            <p className="text-xs font-medium text-[#F97316]">Requires follow-up</p>
          </CardContent>
        </Card>
      </div>

      {/* Order Intake Form */}
      {showOrderForm && (
        <Card className="bg-white border-[#111827]/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              Log New Retailer Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Retailer</Label>
                <Select>
                  <SelectTrigger className="mt-2 border-[#111827]/10">
                    <SelectValue placeholder="Select retailer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="watsons">Watsons</SelectItem>
                    <SelectItem value="mercury">Mercury Drug</SelectItem>
                    <SelectItem value="southstar">Southstar Drug</SelectItem>
                    <SelectItem value="generics">The Generics Pharmacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Order Channel</Label>
                <Select>
                  <SelectTrigger className="mt-2 border-[#111827]/10">
                    <SelectValue placeholder="Select channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viber">Viber</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Terms</Label>
                <Select>
                  <SelectTrigger className="mt-2 border-[#111827]/10">
                    <SelectValue placeholder="Select terms..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30-day">30-day Net</SelectItem>
                    <SelectItem value="60-day">60-day Net</SelectItem>
                    <SelectItem value="installments">Installments</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Order Total</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="mt-2 border-[#111827]/10"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleLogOrder}
                className="flex-1 bg-[#00A3AD] hover:bg-[#0891B2] text-white"
              >
                Log Order
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowOrderForm(false)}
                className="border-[#111827]/20 text-[#111827]"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Retailer Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="delayed">Delayed</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {mockOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-lg border border-[#E5E7EB] hover:border-[#00A3AD] hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-[#111827] mb-1">
                        {order.retailer}
                      </div>
                      <div className="text-sm text-[#6B7280]">
                        {order.orderNumber} • {order.date}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {getPaymentStatusIcon(order.paymentStatus)}
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-[#6B7280] mb-1">Items</div>
                      <div className="text-[#111827] font-medium">{order.items}</div>
                    </div>
                    <div>
                      <div className="text-[#6B7280] mb-1">Total</div>
                      <div className="text-[#111827] font-semibold">{formatPHP(order.total)}</div>
                    </div>
                    <div>
                      <div className="text-[#6B7280] mb-1">Terms</div>
                      <div className="text-[#111827]">{order.paymentTerms}</div>
                    </div>
                    <div>
                      <div className="text-[#6B7280] mb-1">Due Date</div>
                      <div className={order.paymentStatus === "delayed" ? "text-[#F97316] font-medium" : "text-[#111827]"}>
                        {order.dueDate}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E5E7EB]">
                    <MessageSquare className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-xs text-[#6B7280] capitalize">{order.channel}</span>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="paid">
              <div className="text-center py-8 text-[#6B7280]">
                {mockOrders.filter(o => o.paymentStatus === "paid").length} paid orders
              </div>
            </TabsContent>

            <TabsContent value="pending">
              <div className="text-center py-8 text-[#6B7280]">
                {mockOrders.filter(o => o.paymentStatus === "pending").length} pending orders
              </div>
            </TabsContent>

            <TabsContent value="delayed">
              <div className="text-center py-8 text-[#6B7280]">
                {mockOrders.filter(o => o.paymentStatus === "delayed").length} delayed orders
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Payment Tracker */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Payment Health Tracker
          </CardTitle>
          <p className="text-sm text-[#6B7280]">Monitor retailer payment performance</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {retailerPerformance.map((retailer) => (
              <div key={retailer.name} className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-[#111827]">{retailer.name}</div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    retailer.status === "healthy" ? "text-[#00A3AD]" : "text-[#F97316]"
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                    {retailer.status === "healthy" ? "Healthy" : "Needs Attention"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-[#6B7280] mb-1 font-medium">Paid (YTD)</div>
                    <div className="text-lg font-bold text-[#00A3AD]">
                      ₱{(retailer.paid / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280] mb-1 font-medium">Outstanding</div>
                    <div className="text-lg font-bold" style={{ color: retailer.status === "healthy" ? "#6B7280" : "#F97316" }}>
                      ₱{(retailer.pending / 1000).toFixed(0)}K
                    </div>
                  </div>
                </div>

                {/* Payment Health Bar */}
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00A3AD] transition-all"
                    style={{ width: `${(retailer.paid / (retailer.paid + retailer.pending)) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-[#6B7280] mt-1 font-medium">
                  {((retailer.paid / (retailer.paid + retailer.pending)) * 100).toFixed(0)}% collected
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inventory Value by Category - NEW SECTION */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Inventory Value by Category
          </CardTitle>
          <p className="text-sm text-[#6B7280]">Stock value distribution across product categories</p>
        </CardHeader>
        <CardContent>
          {inventoryValueByCategory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Category</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#6B7280]">Total Value (PHP)</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#6B7280]">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryValueByCategory.map((category, index) => {
                    const categoryValue = Number(category.total_value_php ?? 0);
                    const percentage = totalCategoryValue > 0 ? (categoryValue / totalCategoryValue) * 100 : 0;
                    
                    return (
                      <tr key={index} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 text-[#111827] font-medium">{category.category_name || "Uncategorized"}</td>
                        <td className="py-3 px-4 text-right text-[#111827] font-semibold">
                          {formatPHP(categoryValue)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#00A3AD]"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-[#6B7280] font-medium w-12 text-right">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#1A2B47]">
                    <td className="py-3 px-4 text-[#1A2B47] font-bold">Total</td>
                    <td className="py-3 px-4 text-right text-[#1A2B47] font-bold">
                      {formatPHP(totalCategoryValue)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#1A2B47] font-bold">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-[#6B7280]">
              No category data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
