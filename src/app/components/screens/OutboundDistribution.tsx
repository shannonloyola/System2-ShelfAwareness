import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type RetailOrderLine = {
  line_uuid: string;
  sku: string;
  qty: number;
  unit_price: number;
  line_total: number;
  qty_fulfilled: number;
  qty_backordered: number;
};

type RetailOrder = {
  order_uuid: string;
  order_no: string;
  retailer_name: string;
  status: "placed" | "cancelled" | "fulfilled" | "partially_fulfilled";
  total_amount: number;
  payment_terms: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  retail_order_lines: RetailOrderLine[];
};

type AvailableProduct = {
  product_id: string;
  sku: string;
  product_name: string;
  current_stock: number;
  unit_price: number;
};

type FulfillmentLineResult = {
  sku: string;
  qty: number;
  qty_fulfilled: number;
  qty_backordered: number;
  available_stock_before: number;
  available_stock_after: number;
};

type FulfillmentResult = {
  order_uuid?: string;
  order_no?: string;
  status?: RetailOrder["status"];
  backordered?: boolean;
  fulfilled?: boolean;
  qty_backordered_total?: number;
  lines?: FulfillmentLineResult[];
  error?: string;
};

const retailerPerformance = [
  { name: "Watsons", paid: 1250000, pending: 325000, status: "healthy" },
  { name: "Mercury Drug", paid: 980000, pending: 485000, status: "healthy" },
  { name: "Southstar Drug", paid: 450000, pending: 185000, status: "healthy" },
  { name: "The Generics Pharmacy", paid: 280000, pending: 620000, status: "attention" },
];

export function OutboundDistribution() {
  const [showLogForm, setShowLogForm] = useState(false);
  const [totalInventoryValue, setTotalInventoryValue] = useState<number | null>(null);
  const [inventoryValueByCategory, setInventoryValueByCategory] = useState<
    Array<{ category_name: string; total_value_php: number }>
  >([]);
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"All" | "Paid" | "Pending" | "Delayed">("All");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editLines, setEditLines] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newOrder, setNewOrder] = useState({
    retailerName: "",
    paymentTerms: "",
    orderChannel: "",
    dueDate: "",
    notes: "",
    lines: [{ sku: "", qty: 1, unitPrice: 0 }],
  });
  const [availableProducts, setAvailableProducts] = useState<
    AvailableProduct[]
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

  const isLocked = (status: string) =>
    status === "dispatched" || status === "fulfilled";

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("retail_orders")
      .select(`
        order_uuid,
        order_no,
        retailer_name,
        status,
        total_amount,
        payment_terms,
        due_date,
        notes,
        created_at,
        retail_order_lines (
          line_uuid,
          sku,
          qty,
          unit_price,
          line_total,
          qty_fulfilled,
          qty_backordered
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load orders", { description: error.message });
    } else {
      setOrders((data as RetailOrder[]) || []);
    }
    setLoading(false);
  };

  const fetchAvailableProducts = async () => {
    const [productsRes, inventoryRes, pricingRes] =
      await Promise.all([
        supabase
          .from("products")
          .select("product_id, sku, product_name, unit_price")
          .order("product_name"),
        supabase
          .from("v_products_with_inventory")
          .select("product_id, qty_on_hand"),
        supabase
          .from("product_pricing")
          .select(
            "product_id, selling_price, is_active, effective_from, created_at",
          )
          .eq("is_active", true)
          .order("effective_from", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

    if (productsRes.error) {
      toast.error("Failed to load products", {
        description: productsRes.error.message,
      });
      return;
    }

    const inventoryByProductId = new Map<string, number>(
      ((inventoryRes.data as any[]) || []).map((row) => [
        String(row.product_id),
        Number(row.qty_on_hand ?? 0),
      ]),
    );

    const pricingByProductId = new Map<string, number>();
    for (const row of (pricingRes.data as any[]) || []) {
      const productId = String(row.product_id);
      if (!pricingByProductId.has(productId)) {
        pricingByProductId.set(
          productId,
          Number(row.selling_price ?? 0),
        );
      }
    }

    setAvailableProducts(
      (((productsRes.data as any[]) || []).map((product) => {
        const productId = String(product.product_id);
        return {
          product_id: productId,
          sku: product.sku,
          product_name: product.product_name,
          current_stock:
            inventoryByProductId.get(productId) ?? 0,
          unit_price:
            pricingByProductId.get(productId) ??
            Number(product.unit_price ?? 0),
        };
      }) as AvailableProduct[]).sort((a, b) =>
        a.product_name.localeCompare(b.product_name),
      ),
    );
  };

  const lineAvailability = useMemo(() => {
    return newOrder.lines.map((line) => {
      const product = availableProducts.find(
        (entry) => entry.sku === line.sku,
      );
      const available = Number(product?.current_stock ?? 0);
      const requested = Number(line.qty ?? 0);
      const shortage =
        line.sku && requested > available
          ? requested - available
          : 0;

      return {
        sku: line.sku,
        available,
        requested,
        shortage,
        isShort: shortage > 0,
      };
    });
  }, [availableProducts, newOrder.lines]);

  const shortageCount = useMemo(
    () => lineAvailability.filter((line) => line.isShort).length,
    [lineAvailability],
  );

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "All") return true;
    if (activeTab === "Paid") return order.status === "fulfilled";
    if (activeTab === "Pending") return order.status === "placed" || order.status === "partially_fulfilled";
    if (activeTab === "Delayed") {
      return order.due_date
        ? new Date(order.due_date) < new Date() && order.status !== "fulfilled" && order.status !== "cancelled"
        : false;
    }
    return true;
  });

  const statusColor: Record<string, string> = {
    placed: "bg-blue-100 text-blue-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
    partially_fulfilled: "bg-yellow-100 text-yellow-700",
  };

  const openEditModal = (order: any) => {
    setSelectedOrder(order);
    setEditLines(
      (order.retail_order_lines || []).map((line: any) => ({ ...line })),
    );
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    for (const line of editLines) {
      const { error } = await supabase
        .from("retail_order_lines")
        .update({ qty: line.qty })
        .eq("order_uuid", selectedOrder.order_uuid)
        .eq("sku", line.sku);

      if (error) {
        toast.error("Failed to save changes", { description: error.message });
        setSavingEdit(false);
        return;
      }
    }
    setSavingEdit(false);
    setIsEditModalOpen(false);
    toast.success("Order updated successfully.");
    fetchOrders();
  };

  const openCancelModal = (order: any) => {
    setSelectedOrder(order);
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Cancellation reason is required.");
      return;
    }
    if (selectedOrder?.status === "cancelled") {
      toast.error("Order is already cancelled.");
      return;
    }
    setCancellingOrder(true);

    const { data, error } = await supabase
      .rpc("cancel_retail_order", { p_order_uuid: selectedOrder.order_uuid });

    setCancellingOrder(false);

    if (error || !data?.success) {
      toast.error("Order Cancellation Failed", {
        description: data?.error || error?.message,
      });
      return;
    }

    setIsCancelModalOpen(false);
    toast.success("Order Cancelled", {
      description: "Stock has been returned to the warehouse pool.",
    });
    fetchOrders();
  };

  const addLine = () =>
    setNewOrder((prev) => ({
      ...prev,
      lines: [...prev.lines, { sku: "", qty: 1, unitPrice: 0 }],
    }));

  const generateInvoice = (order: RetailOrder) => {
    const doc = new jsPDF();
    const lines = order.retail_order_lines ?? [];
    doc.setFontSize(16);
    doc.text("Enterprise Invoice", 14, 18);
    doc.setFontSize(10);
    const metaStart = 26;
    doc.text(`Invoice #: ${order.order_no ?? "N/A"}`, 14, metaStart);
    doc.text(`Retailer: ${order.retailer_name}`, 14, metaStart + 6);
    doc.text(`Status: ${order.status}`, 14, metaStart + 12);
    doc.text(`Created: ${new Date(order.created_at).toLocaleDateString()}`, 14, metaStart + 18);
    doc.text(`Due Date: ${order.due_date ? new Date(order.due_date).toLocaleDateString() : "N/A"}`, 14, metaStart + 24);
    doc.text(`Payment Terms: ${order.payment_terms ?? "N/A"}`, 14, metaStart + 30);

    autoTable(doc, {
      startY: metaStart + 40,
      head: [["SKU", "Qty", "Unit Price", "Line Total"]],
      body: lines.map((line) => [
        line.sku,
        String(line.qty),
        formatPHP(Number(line.unit_price ?? 0)),
        formatPHP(Number(line.line_total ?? 0)),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [0, 163, 173] },
    });

    const endY = (doc as any).lastAutoTable?.finalY ?? metaStart + 40;
    doc.setFontSize(12);
    doc.text(`Total: ${formatPHP(Number(order.total_amount ?? 0))}`, 14, endY + 10);

    doc.save(`${order.order_no ?? "invoice"}.pdf`);
  };

  const removeLine = (idx: number) =>
    setNewOrder((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));

  const updateLine = (idx: number, field: string, value: string | number) =>
    setNewOrder((prev) => {
      const lines = [...prev.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      return { ...prev, lines };
    });

  const logOrder = async () => {
    if (!newOrder.retailerName.trim()) {
      toast.error("Retailer name is required.");
      return;
    }
    if (newOrder.lines.some((line) => !line.sku.trim())) {
      toast.error("All line items must have a SKU.");
      return;
    }

    setSubmitting(true);

    const { data: order, error: orderError } = await supabase
      .from("retail_orders")
      .insert({
        retailer_name: newOrder.retailerName,
        payment_terms: newOrder.paymentTerms || null,
        due_date: newOrder.dueDate || null,
        notes: newOrder.notes || newOrder.orderChannel || null,
        status: "placed",
      })
      .select("order_uuid")
      .single();

    if (orderError || !order) {
      toast.error("Failed to create order", { description: orderError?.message });
      setSubmitting(false);
      return;
    }

    const lines = newOrder.lines.map((line) => ({
      order_uuid: order.order_uuid,
      sku: line.sku.trim(),
      qty: Number(line.qty),
      unit_price: Number(line.unitPrice),
    }));

    const { error: linesError } = await supabase
      .from("retail_order_lines")
      .insert(lines);

    if (linesError) {
      toast.error("Order created but line items failed", { description: linesError.message });
      setSubmitting(false);
      return;
    }

    const { data: fulfillmentData, error: fulfillmentError } =
      await supabase.rpc("fulfill_retail_order", {
        p_order_uuid: order.order_uuid,
      });

    if (fulfillmentError) {
      toast.error("Order saved but fulfillment failed", {
        description: fulfillmentError.message,
      });
      setSubmitting(false);
      return;
    }

    const fulfillment = (fulfillmentData ||
      {}) as FulfillmentResult;

    if (fulfillment.error) {
      toast.error("Order saved but fulfillment failed", {
        description: fulfillment.error,
      });
      setSubmitting(false);
      return;
    }

    const backorderedQty = Number(
      fulfillment.qty_backordered_total ?? 0,
    );
    toast.success(
      fulfillment.status === "partially_fulfilled"
        ? "Order partially fulfilled"
        : "Order fulfilled",
      {
        description:
          backorderedQty > 0
            ? `${backorderedQty} unit(s) moved to backorder.`
            : "All ordered quantities were allocated from stock.",
      },
    );

    setNewOrder({
      retailerName: "",
      paymentTerms: "",
      orderChannel: "",
      dueDate: "",
      notes: "",
      lines: [{ sku: "", qty: 1, unitPrice: 0 }],
    });
    setShowLogForm(false);
    setSubmitting(false);
    fetchOrders();
    fetchAvailableProducts();
  };

  useEffect(() => {
    void fetchOrders();
    void fetchAvailableProducts();
  }, []);

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
          onClick={() => setShowLogForm(true)}
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

      {showLogForm && (
        <div className="border rounded-xl p-5 bg-white shadow-sm space-y-4 mb-4">
          <h2 className="font-semibold text-gray-800">Log New Retailer Order</h2>
          {shortageCount > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {shortageCount} line{shortageCount === 1 ? "" : "s"} exceed current stock. Available units will be fulfilled first, and the remaining quantity will be saved as backorder.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Retailer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Generika Pharmacy"
                value={newOrder.retailerName}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, retailerName: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Order Channel</label>
              <select
                value={newOrder.orderChannel}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, orderChannel: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="">Select channel...</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Phone">Phone</option>
                <option value="Email">Email</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Payment Terms</label>
              <select
                value={newOrder.paymentTerms}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, paymentTerms: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="">Select terms...</option>
                <option value="COD">COD</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Due Date</label>
              <input
                type="date"
                value={newOrder.dueDate}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, dueDate: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Order Lines</label>
            {/* Header row for order line fields - improved alignment */}
            <div className="flex gap-2 mb-1 pl-1">
              <div className="flex-1 flex justify-start">
                <span className="text-xs text-gray-500">SKU</span>
              </div>
              <div className="w-20 flex justify-center">
                <span className="text-xs text-gray-500">Quantity</span>
              </div>
              <div className="w-28 flex justify-center">
                <span className="text-xs text-gray-500">Unit Price</span>
              </div>
              <div className="w-8" />
            </div>
            {newOrder.lines.map((line, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                <select
                  value={line.sku}
                  onChange={(event) => {
                    const selected = availableProducts.find((p) => p.sku === event.target.value);
                    updateLine(idx, "sku", event.target.value);
                    if (selected) updateLine(idx, "unitPrice", selected.unit_price);
                  }}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">Select SKU...</option>
                  {availableProducts.map((product) => (
                    <option key={product.sku} value={product.sku}>
                      {product.sku} - {product.product_name} (stock: {product.current_stock}, price: {product.unit_price})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  value={line.qty}
                  onChange={(event) => updateLine(idx, "qty", Number(event.target.value))}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Unit Price"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(idx, "unitPrice", Number(event.target.value))}
                  className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                {newOrder.lines.length > 1 && (
                  <button
                    onClick={() => removeLine(idx)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    ✕
                  </button>
                )}
                </div>
                {lineAvailability[idx]?.sku && (
                  <div
                    className={`text-xs ${
                      lineAvailability[idx].isShort
                        ? "text-amber-700"
                        : "text-gray-500"
                    }`}
                  >
                    Available: {lineAvailability[idx].available} unit(s)
                    {lineAvailability[idx].isShort
                      ? ` | Backorder on submit: ${lineAvailability[idx].shortage}`
                      : " | Fully allocatable"}
                  </div>
                )}
              </div>
            ))}
            <button onClick={addLine} className="text-sm text-teal-600 hover:underline mt-1">
              + Add Line
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowLogForm(false)}
              className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={logOrder}
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-sm bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? "Logging..." : "Log Order"}
            </button>
          </div>
        </div>
      )}

      {/* Orders List */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Retailer Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="All">All</TabsTrigger>
              <TabsTrigger value="Paid">Paid</TabsTrigger>
              <TabsTrigger value="Pending">Pending</TabsTrigger>
              <TabsTrigger value="Delayed">Delayed</TabsTrigger>
            </TabsList>
            {["All", "Paid", "Pending", "Delayed"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-3">
                {loading ? (
                  <p className="text-sm text-gray-400 py-8 text-center">Loading orders...</p>
                ) : filteredOrders.length === 0 ? (
                  <p className="text-sm text-gray-400 py-8 text-center">No orders found.</p>
                ) : (
                  filteredOrders.map((order) => (
                    <div key={order.order_uuid} className="border rounded-xl p-4 space-y-3 bg-white shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{order.retailer_name}</p>
                          <p className="text-xs text-gray-400">
                            {order.order_no} · {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[order.status] || "bg-gray-100 text-gray-500"}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs">Items</p>
                          <p className="font-medium">{order.retail_order_lines.length}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Total</p>
                          <p className="font-medium">
                            ₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Terms</p>
                          <p className="font-medium">{order.payment_terms || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Due Date</p>
                          <p className="font-medium">{order.due_date ? new Date(order.due_date).toLocaleDateString() : "N/A"}</p>
                        </div>
                      </div>

                      {order.notes && (
                        <p className="text-xs text-gray-500 italic">📝 {order.notes}</p>
                      )}

                      {(order.retail_order_lines || []).length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                          <div className="space-y-2">
                            {order.retail_order_lines.map((line) => (
                              <div
                                key={line.line_uuid}
                                className="flex items-center justify-between gap-4 text-xs text-gray-600"
                              >
                                <span className="font-mono font-semibold text-gray-800">
                                  {line.sku}
                                </span>
                                <span>Ordered: {line.qty}</span>
                                <span className="text-emerald-700">
                                  Fulfilled: {line.qty_fulfilled ?? 0}
                                </span>
                                <span
                                  className={
                                    Number(line.qty_backordered ?? 0) > 0
                                      ? "text-amber-700 font-medium"
                                      : "text-gray-500"
                                  }
                                >
                                  Backorder: {line.qty_backordered ?? 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => generateInvoice(order)}
                          className="px-3 py-1.5 rounded border text-sm font-medium transition-colors border-teal-400 text-teal-600 hover:bg-teal-50"
                        >
                          Generate Invoice
                        </button>
                        <button
                          onClick={() => openEditModal(order)}
                          disabled={isLocked(order.status)}
                          className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                            isLocked(order.status)
                              ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                              : "border-blue-400 text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openCancelModal(order)}
                          disabled={isLocked(order.status)}
                          className={`px-3 py-1.5 rounded border text-sm font-medium transition-colors ${
                            isLocked(order.status)
                              ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                              : "border-orange-400 text-orange-500 hover:bg-orange-50"
                          }`}
                        >
                          Cancel Order
                        </button>
                        {isLocked(order.status) && (
                          <span className="text-xs text-gray-400 italic">Locked — {order.status}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            ))}
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

      {isEditModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Edit Order</h2>
            <p className="text-sm text-gray-500">
              Modify quantities below. Only available before dispatch.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {editLines.map((line, idx) => (
                <div key={line.sku ?? idx} className="flex items-center justify-between gap-4 border rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{line.sku}</span>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(event) => {
                      const updated = [...editLines];
                      updated[idx] = { ...line, qty: Number(event.target.value) };
                      setEditLines(updated);
                    }}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
              {editLines.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No line items found.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCancelModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Cancel Order</h2>
            <p className="text-sm text-gray-500">
              This will release all reserved stock back to the warehouse pool. This cannot be undone.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="e.g. Customer requested cancellation..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {!cancelReason.trim() && (
                <p className="text-xs text-red-400">This field is required.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancellingOrder || !cancelReason.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancellingOrder ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
