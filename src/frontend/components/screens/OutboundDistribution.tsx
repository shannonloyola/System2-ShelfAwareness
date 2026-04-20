import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "@/utils/supabase/info";
import { useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { supabase } from "@/lib/supabase";
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

const retailerPerformance = [
  { name: "Watsons", paid: 1250000, pending: 325000, status: "healthy" },
  { name: "Mercury Drug", paid: 980000, pending: 485000, status: "healthy" },
  { name: "Southstar Drug", paid: 450000, pending: 185000, status: "healthy" },
  { name: "The Generics Pharmacy", paid: 280000, pending: 620000, status: "attention" },
];

export function OutboundDistribution() {
  // Role guard placeholder - replace with real role source
  const userRole = "Manager"; // TODO: Replace with actual user role from auth context
  const canEditPriority = userRole === "Manager";

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
    lines: [{ sku: "", qty: 1 }],
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

  const buildInvoicePaymentNote = (orderNo: string, notes: string) =>
    [notes.trim(), `[Invoice:${orderNo}]`]
      .filter(Boolean)
      .join(" ")
      .trim();

  const retailOrdersBaseUrl =
    `https://${projectId}.supabase.co/functions/v1/retail-orders`;

  const functionHeaders = {
    apikey: publicAnonKey,
    Authorization: `Bearer ${publicAnonKey}`,
    "Content-Type": "application/json",
  };

  const loadLockedPricingFallback = async () => {
    const restHeaders = {
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      "Content-Type": "application/json",
    };

    const [productsRes, pricingRes, costRes] = await Promise.all([
      fetch(
        `https://${projectId}.supabase.co/rest/v1/products?select=product_id,sku,product_name,unit_price&order=product_name.asc`,
        {
          method: "GET",
          headers: restHeaders,
        },
      ),
      fetch(
        `https://${projectId}.supabase.co/rest/v1/product_pricing?select=product_id,selling_price,is_active,effective_from,created_at&is_active=eq.true&order=effective_from.desc,created_at.desc`,
        {
          method: "GET",
          headers: restHeaders,
        },
      ),
      fetch(
        `https://${projectId}.supabase.co/rest/v1/v_latest_product_cost_price?select=product_id,cost_price`,
        {
          method: "GET",
          headers: restHeaders,
        },
      ),
    ]);

    if (!productsRes.ok) {
      throw new Error(await productsRes.text());
    }

    if (!pricingRes.ok) {
      throw new Error(await pricingRes.text());
    }

    if (!costRes.ok) {
      throw new Error(await costRes.text());
    }

    const [products, pricingRows, costRows] = await Promise.all([
      productsRes.json(),
      pricingRes.json(),
      costRes.json(),
    ]);

    const pricingByProductId = new Map<string, number>();
    for (const row of Array.isArray(pricingRows) ? pricingRows : []) {
      const productId = String(row.product_id);
      if (!pricingByProductId.has(productId)) {
        pricingByProductId.set(productId, Number(row.selling_price ?? 0));
      }
    }

    const costByProductId = new Map<string, number>(
      (Array.isArray(costRows) ? costRows : []).map((row: any) => [
        String(row.product_id),
        Number(row.cost_price ?? 0),
      ]),
    );

    return (Array.isArray(products) ? products : []).map((product: any) => {
      const productId = String(product.product_id);
      return {
        product_id: productId,
        sku: product.sku,
        product_name: product.product_name,
        selling_price:
          pricingByProductId.get(productId) ??
          Number(product.unit_price ?? 0),
        cost_price: costByProductId.get(productId) ?? 0,
      };
    });
  };

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
        priority_level,
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
      .order("priority_rank", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to load orders", { description: error.message });
    } else {
      setOrders((data as RetailOrder[]) || []);
    }
    setLoading(false);
  };

  const fetchInvoiceSummary = async (order: RetailOrder) => {
    setLoadingInvoiceSummary(true);
    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, supplier_name, amount, payment_date, payment_method, reference_no, notes, created_at",
      )
      .eq("supplier_name", order.retailer_name)
      .ilike("notes", `%[Invoice:${order.order_no}]%`)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    setLoadingInvoiceSummary(false);

    if (error) {
      toast.error("Failed to load invoice payment data", {
        description: error.message,
      });
      setInvoiceSummary(null);
      return;
    }

    const payments = ((data as PaymentRecord[]) || []).map((payment) => ({
      ...payment,
      amount: Number(payment.amount ?? 0),
    }));
    const amountPaid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const orderTotal = Number(order.total_amount ?? 0);

    setInvoiceSummary({
      orderTotal,
      amountPaid,
      remainingBalance: Number((orderTotal - amountPaid).toFixed(2)),
      payments,
    });
  };

  const fetchAvailableProducts = async () => {
    const [pricingRes, inventoryRes] =
      await Promise.all([
        fetch(`${retailOrdersBaseUrl}/pricing`, {
          method: "GET",
          headers: functionHeaders,
        }),
        supabase
          .from("v_products_with_inventory")
          .select("product_id, qty_on_hand"),
      ]);

    let serverProducts: any[] = [];

    if (pricingRes.ok) {
      const pricingPayload = await pricingRes.json();
      serverProducts = Array.isArray(pricingPayload?.products)
        ? pricingPayload.products
        : [];
    } else if (pricingRes.status === 404) {
      try {
        serverProducts = await loadLockedPricingFallback();
      } catch (fallbackError) {
        toast.error("Failed to load locked pricing", {
          description:
            fallbackError instanceof Error
              ? fallbackError.message
              : "Retail pricing endpoint is unavailable.",
        });
        return;
      }
    } else {
      toast.error("Failed to load locked pricing", {
        description: await pricingRes.text(),
      });
      return;
    }

    const inventoryByProductId = new Map<string, number>(
      ((inventoryRes.data as any[]) || []).map((row) => [
        String(row.product_id),
        Number(row.qty_on_hand ?? 0),
      ]),
    );

    setAvailableProducts(
      (serverProducts.map((product: any) => {
        const productId = String(product.product_id);
        return {
          product_id: productId,
          sku: product.sku,
          product_name: product.product_name,
          current_stock:
            inventoryByProductId.get(productId) ?? 0,
          selling_price: Number(product.selling_price ?? 0),
          cost_price: Number(product.cost_price ?? 0),
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
      lines: [...prev.lines, { sku: "", qty: 1 }],
    }));

  const generateInvoice = async (order: RetailOrder) => {
    setDownloadingInvoiceId(order.order_uuid);

    try {
      const response = await fetch(
        `${retailOrdersBaseUrl}/orders/${order.order_uuid}/invoice`,
        {
          method: "GET",
          headers: {
            apikey: publicAnonKey,
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        const text = await response.text();
        toast.error("Failed to download invoice", {
          description: text || "Request failed",
        });
        return;
      }

      const blob = await response.blob();
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

    const { error } = await supabase.from("payments").insert({
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

    setSavingPayment(false);

    if (error) {
      toast.error("Failed to log payment", {
        description: error.message,
      });
      return;
    }

    toast.success("Payment logged", {
      description: "Invoice balance has been refreshed.",
    });

    setPaymentForm((prev) => ({
      ...prev,
      amount: "",
      notes: "",
    }));

    await fetchInvoiceSummary(selectedPaymentOrder);
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
    if (newOrder.lines.some((line) => !line.qty || line.qty <= 0)) {
      toast.error("All line items must have quantity greater than 0.");
      return;
    }

    setSubmitting(true);

    const response = await fetch(`${retailOrdersBaseUrl}/orders`, {
      method: "POST",
      headers: functionHeaders,
      body: JSON.stringify({
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
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error("Failed to create order", {
        description:
          response.status === 404
            ? "The retail-orders edge function is not deployed in this Supabase project."
            : payload?.error || payload?.message || "Request failed",
      });
      setSubmitting(false);
      return;
    }

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
      lines: [{ sku: "", qty: 1 }],
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
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                </select>
              </div>
            )}
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
                  onChange={(event) => updateLine(idx, "sku", event.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">Select SKU...</option>
                  {availableProducts.map((product) => (
                    <option key={product.sku} value={product.sku}>
                      {product.sku} - {product.product_name} (stock: {product.current_stock}, locked price: {formatPHP(product.selling_price)})
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
                  type="text"
                  readOnly
                  placeholder="Locked"
                  value={
                    line.sku
                      ? formatPHP(
                          availableProducts.find((product) => product.sku === line.sku)
                            ?.selling_price ?? 0,
                        )
                      : ""
                  }
                  className="w-28 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-center text-gray-600 cursor-not-allowed"
                  title="Locked selling price from the server"
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
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Estimated total from locked server pricing for display only:{" "}
              <span className="font-semibold text-[#1A2B47]">
                {formatPHP(estimatedOrderTotal)}
              </span>
            </div>
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
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-gray-800">{order.retailer_name}</p>
                            <p className="text-xs text-gray-400">
                              {order.order_no} · {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          {order.priority_level === "Urgent" && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-300">
                              Urgent
                            </span>
                          )}
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
                          onClick={() => void generateInvoice(order)}
                          disabled={downloadingInvoiceId === order.order_uuid}
                          className="px-3 py-1.5 rounded border text-sm font-medium transition-colors border-teal-400 text-teal-600 hover:bg-teal-50 disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          {downloadingInvoiceId === order.order_uuid
                            ? "Downloading..."
                            : "Generate Invoice"}
                        </button>
                        <button
                          onClick={() => void openPaymentModal(order)}
                          className="px-3 py-1.5 rounded border text-sm font-medium transition-colors border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                        >
                          Log Payment
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

      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          setIsPaymentModalOpen(open);
          if (!open) {
            setSelectedPaymentOrder(null);
            setInvoiceSummary(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">
              Log Retailer Payment
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Record partial or full check payments and refresh the invoice
              balance immediately.
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentOrder && (
            <div className="space-y-5">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-[#6B7280]">Retailer</div>
                    <div className="font-semibold text-[#111827]">
                      {selectedPaymentOrder.retailer_name}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Invoice</div>
                    <div className="font-semibold text-[#111827]">
                      {selectedPaymentOrder.order_no}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Order Total</div>
                    <div className="font-semibold text-[#111827]">
                      {formatPHP(invoiceSummary?.orderTotal ?? selectedPaymentOrder.total_amount ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280]">Remaining Balance</div>
                    <div className="font-semibold text-[#F97316]">
                      {formatPHP(
                        invoiceSummary?.remainingBalance ??
                          selectedPaymentOrder.total_amount ??
                          0,
                      )}
                    </div>
                  </div>
                </div>
                {loadingInvoiceSummary && (
                  <p className="mt-3 text-xs text-[#6B7280]">
                    Refreshing invoice balance...
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount: event.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentDate: event.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Payment Method
                  </label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        paymentMethod: event.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="Check">Check</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Reference / Check No.
                  </label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        reference: event.target.value,
                      }))
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="Optional payment notes"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E7EB] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold text-[#111827]">
                    Applied Payments
                  </div>
                  <div className="text-sm text-[#6B7280]">
                    Paid: {formatPHP(invoiceSummary?.amountPaid ?? 0)}
                  </div>
                </div>

                {invoiceSummary && invoiceSummary.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {invoiceSummary.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium text-[#111827]">
                            {payment.payment_method ?? "Payment"} |{" "}
                            {payment.reference_no ?? "No ref"}
                          </div>
                          <div className="text-xs text-[#6B7280]">
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-semibold text-emerald-700">
                          {formatPHP(Number(payment.amount ?? 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#6B7280]">
                    No payments logged for this invoice yet.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => void submitPayment()}
                  disabled={savingPayment}
                  className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingPayment ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
