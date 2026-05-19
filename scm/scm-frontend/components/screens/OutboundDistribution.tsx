import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  TrendingUp,
  Search,
  MoreVertical,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Package,
  Trash2,
  Download,
  CreditCard,
  History,
  Info,
  Printer
} from "lucide-react";
import { QRLabelModal } from "../shared/QRLabelModal";
import { SearchableProductSelect } from "../shared/SearchableProductSelect";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  blockInvalidNumberKeys,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
} from "@/lib/inputSanitizers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  getFulfillmentUiState,
  triggerPdfDownload,
} from "./outboundDistribution.helpers";
import {
  cancelDistributionOrder,
  createDistributionOrder,
  createDistributionPayment,
  downloadDistributionInvoice,
  fetchDistributionAvailableProducts,
  fetchDistributionInventoryValueByCategory,
  fetchDistributionInventoryValueTotal,
  fetchDistributionInvoiceSummary,
  fetchDistributionOrders,
  updateDistributionOrderLines,
} from "@/lib/distributionService";

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
  priority_level: string | null;
  retail_order_lines: RetailOrderLine[];
};

type AvailableProduct = {
  product_id: string;
  sku: string;
  product_name: string;
  current_stock: number;
  selling_price: number;
  cost_price: number;
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

type PaymentRecord = {
  id: string;
  supplier_name: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
};

type InvoiceSummary = {
  orderTotal: number;
  amountPaid: number;
  remainingBalance: number;
  payments: PaymentRecord[];
};

export function OutboundDistribution() {
  const { role } = useAuth();
  const canEditPriority =
    role === "owner_president" ||
    role === "logistics_coordinator" ||
    role === "warehouse_manager";

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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderForCartonQR, setSelectedOrderForCartonQR] = useState<RetailOrder | null>(null);
  const [showCartonQRModal, setShowCartonQRModal] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] =
    useState<RetailOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editLines, setEditLines] = useState<any[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const [loadingInvoiceSummary, setLoadingInvoiceSummary] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [invoiceSummary, setInvoiceSummary] = useState<InvoiceSummary | null>(
    null,
  );
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Check",
    reference: "",
    notes: "",
  });
  const [newOrder, setNewOrder] = useState({
    retailerName: "",
    branchSuffix: "",
    paymentTerms: "",
    orderChannel: "",
    dueDate: "",
    notes: "",
    priorityLevel: "",
    lines: [{ sku: "", qty: "1" }],
  });
  const [availableProducts, setAvailableProducts] = useState<
    AvailableProduct[]
  >([]);

  const formatPHP = (amount: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const getPriorityRank = (priorityLevel: string | null) => {
    if (priorityLevel === "Urgent") return 1;
    if (priorityLevel === "High") return 2;
    return 3;
  };

  const buildInvoicePaymentNote = (orderNo: string, notes: string) =>
    [notes.trim(), `[Invoice:${orderNo}]`]
      .filter(Boolean)
      .join(" ")
      .trim();

  // Fetch Total Inventory Value
  useEffect(() => {
    const fetchTotalInventoryValue = async () => {
      try {
        const total = await fetchDistributionInventoryValueTotal();
        setTotalInventoryValue(total);
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
        const data = await fetchDistributionInventoryValueByCategory();
        setInventoryValueByCategory(data || []);
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
    try {
      const ordersData = await fetchDistributionOrders();
      const normalizedOrders = (((ordersData as RetailOrder[]) || [])).map((order) => ({
        ...order,
        total_amount: Number(order.total_amount ?? 0),
        retail_order_lines: (order.retail_order_lines ?? []).map((line) => ({
          ...line,
          line_total: Number(
            line.line_total ?? Number(line.qty ?? 0) * Number(line.unit_price ?? 0),
          ),
        })),
      }));

      const sortedOrders = [ ...normalizedOrders ].sort((a, b) => {
        const priorityDiff =
          getPriorityRank(a.priority_level) -
          getPriorityRank(b.priority_level);

        if (priorityDiff !== 0) return priorityDiff;

        return (
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime()
        );
      });
      setOrders(sortedOrders);
    } catch (error) {
      toast.error("Failed to load orders", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalOutstanding = useMemo(() => 
    orders
      .filter(o => o.status === "placed" || o.status === "partially_fulfilled")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  , [orders]);

  const totalCollected = useMemo(() => 
    orders
      .filter(o => o.status === "fulfilled")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
  , [orders]);

  const overdueCount = useMemo(() => 
    orders
      .filter(o => o.status !== "fulfilled" && o.status !== "cancelled" && o.due_date && new Date(o.due_date) < new Date())
      .length
  , [orders]);

  const retailerCount = useMemo(() => new Set(orders.map(o => o.retailer_name)).size, [orders]);

  const fetchInvoiceSummary = async (order: RetailOrder) => {
    setLoadingInvoiceSummary(true);
    try {
      const data = await fetchDistributionInvoiceSummary({
        orderId: order.order_uuid,
        retailerName: order.retailer_name,
        orderNo: order.order_no ?? "",
        orderTotal: Number(order.total_amount ?? 0),
      });
      setInvoiceSummary(data);
      return data;
    } catch (error) {
      toast.error("Failed to load invoice payment data", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      });
      setInvoiceSummary(null);
      return null;
    } finally {
      setLoadingInvoiceSummary(false);
    }
  };

  const fetchAvailableProducts = async () => {
    try {
      const rows = await fetchDistributionAvailableProducts();
      setAvailableProducts(
        (rows as AvailableProduct[]).sort((a, b) =>
          a.product_name.localeCompare(b.product_name),
        ),
      );
    } catch (error) {
      toast.error("Failed to load fulfillment inventory", {
        description:
          error instanceof Error
            ? error.message
            : "Fulfillment inventory source is unavailable.",
      });
    }
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

  const estimatedOrderTotal = useMemo(
    () =>
      newOrder.lines.reduce((sum, line) => {
        const product = availableProducts.find(
          (entry) => entry.sku === line.sku,
        );
        return (
          sum +
          Number(product?.selling_price ?? 0) *
            Number(line.qty ?? 0)
        );
      }, 0),
    [availableProducts, newOrder.lines],
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
      (order.retail_order_lines || []).map((line: any) => ({
        ...line,
        qty: String(line.qty ?? ""),
      })),
    );
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    for (const line of editLines) {
      const parsedQty = Number.parseInt(String(line.qty), 10);
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        toast.error("Quantity must be greater than 0.");
        setSavingEdit(false);
        return;
      }

      try {
        await updateDistributionOrderLines(selectedOrder.order_uuid, [
          { sku: line.sku, qty: parsedQty },
        ]);
      } catch (error) {
        toast.error("Failed to save changes", {
          description:
            error instanceof Error ? error.message : "Unknown error",
        });
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

  const openPaymentModal = async (order: RetailOrder) => {
    setSelectedPaymentOrder(order);
    setPaymentForm({
      amount: "",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "Check",
      reference: order.order_no ?? "",
      notes: "",
    });
    setIsPaymentModalOpen(true);
    await fetchInvoiceSummary(order);
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

    try {
      await cancelDistributionOrder(
        selectedOrder.order_uuid,
        cancelReason.trim(),
      );
      setIsCancelModalOpen(false);
      toast.success("Order Cancelled", {
        description: "Stock has been returned to the warehouse pool.",
      });
      fetchOrders();
    } catch (error) {
      toast.error("Order Cancellation Failed", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setCancellingOrder(false);
    }
  };

  const addLine = () =>
    setNewOrder((prev) => ({
      ...prev,
      lines: [...prev.lines, { sku: "", qty: "1" }],
    }));

  const generateInvoice = async (order: RetailOrder) => {
    setDownloadingInvoiceId(order.order_uuid);

    try {
      const blob = await downloadDistributionInvoice(order.order_uuid);
      triggerPdfDownload({
        blob,
        filename: `${order.order_no ?? "invoice"}.pdf`,
        documentRef: document,
        urlRef: URL,
      });
    } catch (error) {
      toast.error("Failed to download invoice", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const submitPayment = async () => {
    if (!selectedPaymentOrder) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Payment amount must be greater than 0.");
      return;
    }

    if (!paymentForm.paymentDate) {
      toast.error("Payment date is required.");
      return;
    }

    if (!paymentForm.reference.trim()) {
      toast.error("Reference / check number is required.");
      return;
    }

    setSavingPayment(true);

    try {
      await createDistributionPayment({
        supplier_name: selectedPaymentOrder.retailer_name,
        amount,
        payment_date: paymentForm.paymentDate,
        payment_method: paymentForm.paymentMethod || "Check",
        reference_no: paymentForm.reference.trim(),
        notes: buildInvoicePaymentNote(
          selectedPaymentOrder.order_no ?? "invoice",
          paymentForm.notes,
        ),
      });

      toast.success("Payment logged", {
        description: "Invoice balance has been refreshed.",
      });

      setPaymentForm((prev) => ({
        ...prev,
        amount: "",
        notes: "",
      }));

      const newSummary = await fetchInvoiceSummary(selectedPaymentOrder);
      await fetchOrders();
      if (newSummary && newSummary.remainingBalance <= 0) {
        setIsPaymentModalOpen(false);
      }
    } catch (error) {
      toast.error("Failed to log payment", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSavingPayment(false);
    }
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
      toast.error("Company name is required.");
      return;
    }
    if (newOrder.lines.some((line) => !line.sku.trim())) {
      toast.error("All line items must have a SKU.");
      return;
    }
    if (
      newOrder.lines.some((line) => {
        const parsedQty = Number.parseInt(String(line.qty), 10);
        return !Number.isFinite(parsedQty) || parsedQty <= 0;
      })
    ) {
      toast.error("All line items must have quantity greater than 0.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = await createDistributionOrder({
        retailer_name: newOrder.retailerName,
        branch_suffix: newOrder.branchSuffix || null,
        payment_terms: newOrder.paymentTerms || null,
        due_date: newOrder.dueDate || null,
        notes: newOrder.notes || newOrder.orderChannel || null,
        priority_level: newOrder.priorityLevel || null,
        lines: newOrder.lines.map((line) => ({
          sku: line.sku.trim(),
          qty: Number(line.qty),
        })),
      });

      const fulfillment = (payload?.fulfillment ||
        {}) as FulfillmentResult;

      if (fulfillment.error) {
        toast.error("Order saved but fulfillment failed", {
          description: fulfillment.error,
        });
        setSubmitting(false);
        return;
      }

      const fulfillmentUiState = getFulfillmentUiState(fulfillment);
      toast.success(
        fulfillmentUiState.toastTitle,
        {
          description: fulfillmentUiState.toastDescription,
        },
      );

      setNewOrder({
        retailerName: "",
        branchSuffix: "",
        paymentTerms: "",
        orderChannel: "",
        dueDate: "",
        notes: "",
        priorityLevel: "",
        lines: [{ sku: "", qty: "1" }],
      });
      setShowLogForm(false);
      fetchOrders();
      fetchAvailableProducts();
    } catch (error) {
      toast.error("Failed to create order", {
        description:
          error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    void fetchAvailableProducts();
  }, []);

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
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
              <label className="text-sm font-medium text-gray-700">Branch Suffix</label>
              <input
                type="text"
                placeholder="e.g. Branch 1"
                value={newOrder.branchSuffix}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, branchSuffix: event.target.value }))
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
            {canEditPriority && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Priority Level</label>
                <select
                  value={newOrder.priorityLevel}
                  onChange={(event) =>
                    setNewOrder((prev) => ({ ...prev, priorityLevel: event.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">Select priority...</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Order Items</label>
              <Button
                variant="outline"
                size="sm"
                onClick={addLine}
                className="text-xs border-teal-600 text-teal-600 hover:bg-teal-50"
              >
                + Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {newOrder.lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <SearchableProductSelect
                      options={availableProducts.map((p) => ({
                        sku: p.sku,
                        name: `${p.product_name} (${p.sku})`,
                        price: p.selling_price,
                        stock: p.current_stock,
                      }))}
                      value={line.sku}
                      onChange={(val) => updateLine(idx, "sku", val)}
                      placeholder="Type or select product..."
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, "qty", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(idx)}
                    disabled={newOrder.lines.length === 1}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t flex items-center justify-between">
            <div className="text-sm">
              <span className="text-gray-500">Estimated Total: </span>
              <span className="font-bold text-gray-900">₱{estimatedOrderTotal.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowLogForm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={logOrder}
                disabled={submitting}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {submitting ? "Logging..." : "Create Order"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="All" onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-transparent border-b border-gray-200 w-full justify-start rounded-none h-auto p-0 gap-8">
          {["All", "Paid", "Pending", "Delayed"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00A3AD] data-[state=active]:bg-transparent data-[state=active]:text-[#00A3AD] pb-4 px-0 font-medium transition-all"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="bg-white rounded-xl shadow-sm border border-[#111827]/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F8FAFC] border-b border-[#111827]/10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Order #</th>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Retailer</th>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Status</th>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Amount</th>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Terms</th>
                    <th className="px-6 py-4 font-semibold text-[#111827]">Due Date</th>
                    <th className="px-6 py-4 font-semibold text-[#111827] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#111827]/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#6B7280]">
                        Loading orders...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#6B7280]">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.order_uuid} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-6 py-4 font-medium text-[#111827]">
                          {order.order_no}
                          <div className="text-[10px] text-[#6B7280] font-mono mt-0.5">
                            {order.order_uuid.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#111827] font-medium">
                          {order.retailer_name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[order.status]}`}>
                            {order.status.replace("_", " ")}
                          </span>
                          {order.priority_level && order.priority_level !== "Normal" && (
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              order.priority_level === "Urgent" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                            }`}>
                              {order.priority_level.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-[#111827]">
                          {formatPHP(order.total_amount)}
                        </td>
                        <td className="px-6 py-4 text-[#6B7280]">
                          {order.payment_terms || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-[#6B7280]">
                          {order.due_date ? new Date(order.due_date).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {(order.status === "placed" || order.status === "partially_fulfilled") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedOrderForCartonQR(order);
                                setShowCartonQRModal(true);
                              }}
                              className="text-[#00A3AD] hover:bg-[#00A3AD]/10"
                              title="Print Carton QR"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openPaymentModal(order)}
                            className="text-[#00A3AD] hover:bg-[#00A3AD]/10"
                            title="Payments"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateInvoice(order)}
                            disabled={downloadingInvoiceId === order.order_uuid}
                            className="text-[#6B7280] hover:bg-gray-100"
                            title="Invoice"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(order)}
                            disabled={isLocked(order.status)}
                            className="text-[#6B7280] hover:bg-gray-100 disabled:opacity-30"
                            title="Edit"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCancelModal(order)}
                            disabled={isLocked(order.status) || order.status === "cancelled"}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                            title="Cancel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Order Lines: {selectedOrder?.order_no}</DialogTitle>
            <DialogDescription>
              Adjust quantities for the selected order. Note that fulfillment status may reset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editLines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs text-gray-500">Product SKU</Label>
                  <p className="font-medium">{line.sku}</p>
                </div>
                <div className="w-32">
                  <Label className="text-xs text-gray-500">Quantity</Label>
                  <Input
                    type="number"
                    value={line.qty}
                    onChange={(e) => {
                      const newLines = [...editLines];
                      newLines[idx].qty = e.target.value;
                      setEditLines(newLines);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit}
              className="bg-teal-600 text-white hover:bg-teal-700"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Order {selectedOrder?.order_no}</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All reserved stock will be returned to the pool.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Reason for cancellation <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Customer changed mind, payment failed..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
              Back
            </Button>
            <Button
              onClick={confirmCancel}
              disabled={cancellingOrder}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancellingOrder ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-600" />
              Invoice Payment Management
            </DialogTitle>
            <DialogDescription>
              Log collection payments and track the remaining balance for {selectedPaymentOrder?.retailer_name}.
            </DialogDescription>
          </DialogHeader>

          {loadingInvoiceSummary ? (
            <div className="py-12 text-center text-gray-500">Loading summary...</div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Balances */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <p className="text-xs text-gray-500 font-medium">Order Total</p>
                  <p className="text-xl font-bold">{formatPHP(invoiceSummary?.orderTotal ?? 0)}</p>
                </div>
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                  <p className="text-xs text-teal-600 font-medium">Amount Paid</p>
                  <p className="text-xl font-bold text-teal-700">{formatPHP(invoiceSummary?.amountPaid ?? 0)}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                  <p className="text-xs text-orange-600 font-medium">Remaining Balance</p>
                  <p className="text-xl font-bold text-orange-700">{formatPHP(invoiceSummary?.remainingBalance ?? 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Payment History */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-400" />
                    Payment History
                  </h3>
                  <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    {invoiceSummary?.payments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-400">No payments logged yet.</div>
                    ) : (
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {invoiceSummary?.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatPHP(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* New Payment Form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-teal-600" />
                    Log New Collection
                  </h3>
                  
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="text-xs">Amount Collected (PHP) <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({...paymentForm, amount: sanitizeDecimalInput(e.target.value)})}
                        onKeyDown={(e) => blockInvalidNumberKeys(e, { allowDecimal: true })}
                        className="border border-gray-300 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
                        className="border border-gray-300 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reference # / Check # <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="e.g. CHK-9902"
                        value={paymentForm.reference}
                        onChange={(e) => setPaymentForm({...paymentForm, reference: e.target.value})}
                        className="border border-gray-300 focus:border-teal-500 focus:ring-teal-500 focus-visible:ring-teal-500"
                      />
                    </div>
                    <Button
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={submitPayment}
                      disabled={savingPayment || !paymentForm.amount}
                    >
                      {savingPayment ? "Processing..." : "Confirm Payment"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {selectedOrderForCartonQR && (
        <QRLabelModal
          isOpen={showCartonQRModal}
          onClose={() => setShowCartonQRModal(false)}
          qrValue={selectedOrderForCartonQR.order_no}
          title={`Carton: ${selectedOrderForCartonQR.order_no}`}
          subtitle="Outbound Carton Label"
          fields={[
            { label: "ORDER NUMBER", value: selectedOrderForCartonQR.order_no },
            { label: "CUSTOMER / DESTINATION", value: selectedOrderForCartonQR.retailer_name },
            { label: "TOTAL ITEMS", value: `${selectedOrderForCartonQR.retail_order_lines.reduce((sum, line) => sum + line.qty, 0)} units` },
            { label: "DISPATCH DATE", value: selectedOrderForCartonQR.due_date ? new Date(selectedOrderForCartonQR.due_date).toLocaleDateString() : "As Scheduled" },
            { label: "PAYMENT TERMS", value: selectedOrderForCartonQR.payment_terms || "N/A" },
          ]}
          items={selectedOrderForCartonQR.retail_order_lines.map((line) => {
            const prod = availableProducts.find((p) => p.sku === line.sku);
            return {
              sku: line.sku,
              name: prod?.product_name || line.sku,
              quantity: line.qty,
            };
          })}
        />
      )}
    </div>
  );
}
