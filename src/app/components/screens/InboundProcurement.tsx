import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Plus,
  Send,
  Download,
  MessageCircle,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";

type TabFilter = "all" | "draft" | "posted";

interface PurchaseOrderRow {
  po_id: string;
  po_no: string | null;
  supplier_name: string | null;
  status: string | null;
  created_at: string | null;
  expected_delivery_date: string | null;
  preferred_communication: string | null;
}

interface PurchaseOrderItemRow {
  po_item_id: string;
  po_id: string;
  item_name: string | null;
  quantity: number | null;
}

interface ProductRow {
  sku: string | null;
  product_name: string | null;
  unit: string | null;
  barcode: string | null;
}

interface LineItemForm {
  formId: string;
  editingPoItemId: string | null;
  product: string;
  qty: number;
}

const DEFAULT_PO_STATUS = "Pending Supplier Confirmation";

const normalizeStatus = (status: string | null) => (status ?? "").trim().toLowerCase();

const formatDate = (value: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const toErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Unexpected error";
  const maybe = error as { status?: number; message?: string; code?: string };
  if (maybe.status === 401 || maybe.status === 403) return "No permission / check RLS";
  return maybe.message ?? maybe.code ?? "Unexpected error";
};

const isDuplicatePoNumberError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  if (maybe.code === "23505") return true;
  return /duplicate|unique/i.test(maybe.message ?? "");
};

const includesDraftTab = (status: string | null) => {
  const normalized = normalizeStatus(status);
  return normalized === "draft" || normalized === "pending supplier confirmation";
};

const getStatusColor = (status: string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === "draft" || normalized === "pending supplier confirmation") {
    return "bg-[#D1D5DB] text-[#111827]";
  }
  if (normalized === "posted") return "bg-[#00A3AD] text-white";
  if (normalized === "in-transit") return "bg-[#1A2B47] text-white";
  if (normalized === "received") return "bg-[#00A3AD] text-white";
  return "bg-[#E5E7EB] text-[#111827]";
};

const buildProductLabel = (product: ProductRow) => {
  const sku = (product.sku ?? "").trim();
  const name = (product.product_name ?? "").trim();
  if (!sku && !name) return "";
  if (!sku) return name;
  if (!name) return sku;
  return `${sku} - ${name}`;
};


export function InboundProcurement() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [showPOForm, setShowPOForm] = useState(false);

  const [poList, setPoList] = useState<PurchaseOrderRow[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [selectedPOItems, setSelectedPOItems] = useState<PurchaseOrderItemRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [poNo, setPoNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [preferredCommunication, setPreferredCommunication] = useState("");

  const [lineItemForms, setLineItemForms] = useState<LineItemForm[]>([]);

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [creatingPO, setCreatingPO] = useState(false);
  const [addingItem, setAddingItem] = useState(false);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPOs(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication")
      .order("created_at", { ascending: false });
    setLoadingPOs(false);

    if (error) {
      toast.error("Failed to load purchase orders", { description: toErrorMessage(error) });
      setPoList([]);
      return;
    }
    setPoList(data ?? []);
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("sku, product_name, unit, barcode")
      .order("product_name", { ascending: true });

    if (error) {
      toast.error("Failed to load product master", { description: toErrorMessage(error) });
      setProducts([]);
      return;
    }
    setProducts(data ?? []);
  }, []);

  const fetchPOItems = useCallback(async (poId: string) => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("purchase_order_items")
      .select("po_item_id, po_id, item_name, quantity")
      .eq("po_id", poId)
      .order("po_item_id", { ascending: true });
    setLoadingItems(false);

    if (error) {
      toast.error("Failed to load purchase order items", { description: toErrorMessage(error) });
      setSelectedPOItems([]);
      return;
    }
    setSelectedPOItems(data ?? []);
  }, []);

  const generateUniquePONumber = useCallback(async () => {
    const year = new Date().getFullYear();
    const prefix = `PO-JP-${year}-`;

    const { data, error } = await supabase
      .from("purchase_orders")
      .select("po_no")
      .like("po_no", `${prefix}%`);

    if (error) throw error;

    const maxSuffix = (data ?? []).reduce((max, row) => {
      const value = row.po_no ?? "";
      const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
      if (!match) return max;
      const n = Number(match[1]);
      if (Number.isNaN(n)) return max;
      return Math.max(max, n);
    }, 0);

    return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
  }, []);

  const createDraftPO = useCallback(async () => {
    if (!supplierName.trim()) {
      toast.error("Cannot create draft P.O.", { description: "Supplier is required" });
      return;
    }

    setCreatingPO(true);
    try {
      const basePoNo = poNo || (await generateUniquePONumber());
      const tryInsert = async (poNumber: string, allowRetry: boolean) => {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("purchase_orders")
          .insert([
            {
              po_no: poNumber,
              supplier_name: supplierName.trim(),
              status: DEFAULT_PO_STATUS,
              created_at: nowIso,
              paid_at: nowIso,
              expected_delivery_date: expectedDeliveryDate || null,
              preferred_communication: preferredCommunication || null,
            },
          ])
          .select("po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication")
          .single();

        if (!error && data) return data as PurchaseOrderRow;
        if (error && allowRetry && isDuplicatePoNumberError(error)) {
          const nextPoNo = await generateUniquePONumber();
          setPoNo(nextPoNo);
          return tryInsert(nextPoNo, false);
        }
        throw error ?? new Error("Insert failed");
      };

      const created = await tryInsert(basePoNo, true);
      toast.success("Draft P.O. created", { description: `${created.po_no ?? ""} saved.` });
      await fetchPurchaseOrders();
      setSelectedPO(created);
      setShowPOForm(false);
      setSupplierName("");
      setPoNo("");
      setExpectedDeliveryDate("");
      setPreferredCommunication("");
      await fetchPOItems(created.po_id);
    } catch (error) {
      toast.error("Failed to create draft P.O.", { description: toErrorMessage(error) });
    } finally {
      setCreatingPO(false);
    }
  }, [expectedDeliveryDate, fetchPOItems, fetchPurchaseOrders, generateUniquePONumber, poNo, preferredCommunication, supplierName]);

  const savePOItem = useCallback(async (formId: string) => {
    const form = lineItemForms.find((f) => f.formId === formId);
    if (!form) return;

    if (!selectedPO?.po_id) {
      toast.error("Cannot save line item", { description: "Select a purchase order first" });
      return;
    }
    if (!form.product) {
      toast.error("Cannot save line item", { description: "Product is required" });
      return;
    }
    if (!Number.isFinite(form.qty) || form.qty <= 0) {
      toast.error("Cannot save line item", { description: "Quantity must be greater than 0" });
      return;
    }

    setAddingItem(true);

    let error: unknown = null;
    if (form.editingPoItemId) {
      const result = await supabase
        .from("purchase_order_items")
        .update({ quantity: form.qty })
        .eq("po_id", selectedPO.po_id)
        .eq("po_item_id", form.editingPoItemId);
      error = result.error;
    } else {
      const duplicateExists = selectedPOItems.some(
        (item) => (item.item_name ?? "").trim().toLowerCase() === form.product.trim().toLowerCase(),
      );
      if (duplicateExists) {
        setAddingItem(false);
        toast.error("Cannot save line item", { description: "Duplicate line item is not allowed" });
        return;
      }
      const result = await supabase
        .from("purchase_order_items")
        .insert([
          {
            po_id: selectedPO.po_id,
            item_name: form.product,
            quantity: form.qty,
          },
        ]);
      error = result.error;
    }
    setAddingItem(false);

    if (error) {
      toast.error("Failed to save line item", { description: toErrorMessage(error) });
      return;
    }

    toast.success(form.editingPoItemId ? "Line item quantity updated" : "Line item added");
    setLineItemForms((prev) => prev.filter((f) => f.formId !== formId));
    await fetchPOItems(selectedPO.po_id);
  }, [fetchPOItems, lineItemForms, selectedPO?.po_id, selectedPOItems]);

  const deletePOItem = useCallback(async (formId: string) => {
    const form = lineItemForms.find((f) => f.formId === formId);
    if (!form) return;

    if (!form.editingPoItemId) {
      setLineItemForms((prev) => prev.filter((f) => f.formId !== formId));
      return;
    }
    if (!selectedPO?.po_id) return;

    setAddingItem(true);
    const { error } = await supabase
      .from("purchase_order_items")
      .delete()
      .eq("po_id", selectedPO.po_id)
      .eq("po_item_id", form.editingPoItemId);
    setAddingItem(false);

    if (error) {
      toast.error("Failed to delete line item", { description: toErrorMessage(error) });
      return;
    }

    toast.success("Line item deleted");
    setLineItemForms((prev) => prev.filter((f) => f.formId !== formId));
    await fetchPOItems(selectedPO.po_id);
  }, [fetchPOItems, lineItemForms, selectedPO?.po_id]);

  useEffect(() => {
    void fetchPurchaseOrders();
    void fetchProducts();
  }, [fetchPurchaseOrders, fetchProducts]);

  useEffect(() => {
    if (!selectedPO?.po_id) {
      setSelectedPOItems([]);
      return;
    }
    void fetchPOItems(selectedPO.po_id);
  }, [fetchPOItems, selectedPO?.po_id]);

  const filteredPOs = useMemo(() => {
    if (activeTab === "all") return poList;
    if (activeTab === "draft") return poList.filter((po) => includesDraftTab(po.status));
    return poList.filter((po) => normalizeStatus(po.status) === "posted");
  }, [activeTab, poList]);

  const openBuilder = async () => {
    const nextValue = !showPOForm;
    setShowPOForm(nextValue);
    setSelectedPO(null);
    setSelectedPOItems([]);
    setLineItemForms([]);
    setSupplierName("");
    setPoNo("");
    setExpectedDeliveryDate("");
    setPreferredCommunication("");
    if (nextValue) {
      try {
        setPoNo(await generateUniquePONumber());
      } catch (error) {
        toast.error("Failed to generate P.O. number", { description: toErrorMessage(error) });
      }
    }
  };

  const selectPO = (po: PurchaseOrderRow) => {
    setSelectedPO(po);
    setShowPOForm(false);
    setLineItemForms([]);
  };

  const showDetails = !!selectedPO && !showPOForm;

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Inbound Procurement & Logistics
          </h1>
          <p className="text-[#6B7280]">Manage purchase orders and track shipments from Japan</p>
        </div>
        <Button onClick={() => void openBuilder()} className="bg-[#00A3AD] hover:bg-[#0891B2] text-white shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          New P.O.
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="bg-white border-[#111827]/10 shadow-sm h-fit self-start">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">Japan P.O. Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="posted">Posted</TabsTrigger>
              </TabsList>

              {(["all", "draft", "posted"] as TabFilter[]).map((tab) => {
                const tabPOs =
                  tab === "all"
                    ? poList
                    : tab === "draft"
                      ? poList.filter((po) => includesDraftTab(po.status))
                      : poList.filter((po) => normalizeStatus(po.status) === "posted");

                return (
                  <TabsContent key={tab} value={tab} className="space-y-3">
                    {loadingPOs ? (
                      <div className="text-sm text-[#6B7280] p-2">Loading purchase orders...</div>
                    ) : tabPOs.length === 0 ? (
                      <div className="text-sm text-[#6B7280] p-2">No purchase orders found.</div>
                    ) : (
                      tabPOs.map((po) => (
                        <div
                          key={po.po_id}
                          onClick={() => selectPO(po)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                            selectedPO?.po_id === po.po_id && showDetails
                              ? "border-[#00A3AD] bg-[#00A3AD]/5"
                              : "border-[#E5E7EB] hover:border-[#00A3AD]/50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div>
                              <div className="font-semibold text-[#111827]">{po.po_no ?? "N/A"}</div>
                              <div className="text-sm text-[#6B7280]">{po.supplier_name ?? "N/A"}</div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                              {po.status ?? "Unknown"}
                            </span>
                          </div>
                          <div className="text-xs text-[#6B7280]">
                            <span className="font-semibold">Date Created:</span> {formatDate(po.created_at)}
                          </div>
                          <div className="text-xs text-[#6B7280]">
                            <span className="font-semibold">Expected Delivery:</span> {formatDateOnly(po.expected_delivery_date)}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              {showDetails ? "P.O. Details" : "P.O. Builder"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showDetails ? (
              <div className="space-y-4">
                <div>
                  <Label>P.O. Number</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={poNo}
                      readOnly
                      className="bg-[#F8FAFC] border-[#111827]/10 rounded-lg"
                    />
                    <Button
                      size="sm"
                      className="bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg"
                      onClick={async () => {
                        try {
                          setPoNo(await generateUniquePONumber());
                          toast.success("P.O. Number Generated");
                        } catch (error) {
                          toast.error("Failed to generate P.O. number", { description: toErrorMessage(error) });
                        }
                      }}
                    >
                      Auto-Generate
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Supplier</Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Enter supplier name..."
                    className="mt-2 border-[#111827]/10 rounded-lg"
                  />
                </div>

                <div>
                  <Label>Expected Delivery Date</Label>
                  <div className="relative mt-2">
                    <Input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="border-[#111827]/10 rounded-lg pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    <Calendar className="w-4 h-4 text-[#6B7280] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <Label>Preferred Communication</Label>
                  <Select value={preferredCommunication} onValueChange={setPreferredCommunication}>
                    <SelectTrigger className="mt-2 border-[#111827]/10 rounded-lg">
                      <SelectValue placeholder="Choose communication method..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-[#25D366]" />
                          <span>WhatsApp</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="viber">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-[#7360F2]" />
                          <span>Viber</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-[#6B7280]" />
                          <span>Email</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => void createDraftPO()}
                    className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg font-bold"
                    disabled={creatingPO}
                  >
                    {creatingPO ? "Creating Draft..." : "Create Draft P.O."}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#6B7280]">P.O. Number</Label>
                    <div className="text-[#111827] font-medium mt-1">{selectedPO.po_no ?? "N/A"}</div>
                  </div>
                  <div>
                    <Label className="text-[#6B7280]">Status</Label>
                    <div className="mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPO.status)}`}>
                        {selectedPO.status ?? "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#6B7280]">Created</Label>
                    <div className="text-[#111827] mt-1">{formatDate(selectedPO.created_at)}</div>
                  </div>
                  <div>
                    <Label className="text-[#6B7280]">Supplier</Label>
                    <div className="text-[#111827] mt-1">{selectedPO.supplier_name ?? "N/A"}</div>
                  </div>
                  <div>
                    <Label className="text-[#6B7280]">Expected Delivery</Label>
                    <div className="text-[#111827] mt-1">{formatDateOnly(selectedPO.expected_delivery_date)}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[#6B7280]">Line Items</Label>
                  {loadingItems ? (
                    <div className="text-sm text-[#6B7280]">Loading items...</div>
                  ) : selectedPOItems.length === 0 ? (
                    <div className="text-sm text-[#6B7280]">No items yet for this purchase order.</div>
                  ) : (
                    selectedPOItems.map((item) => (
                      <div
                        key={item.po_item_id}
                        onClick={() => {
                          setLineItemForms((prev) => {
                            const exists = prev.some((f) => f.editingPoItemId === item.po_item_id);
                            if (exists) return prev;
                            return [
                              ...prev,
                              {
                                formId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                editingPoItemId: item.po_item_id,
                                product: item.item_name ?? "",
                                qty: item.quantity ?? 1,
                              },
                            ];
                          });
                        }}
                        className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                          lineItemForms.some((f) => f.editingPoItemId === item.po_item_id)
                            ? "border-[#00A3AD] bg-[#00A3AD]/5"
                            : "border-[#E5E7EB] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <div className="text-sm text-[#111827]">{item.item_name ?? "Unnamed item"}</div>
                        <div className="text-sm font-semibold text-[#111827]">Qty: {item.quantity ?? 0}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-[#E5E7EB] p-3">
                  <Label>Line Item Actions</Label>
                  <Button
                    onClick={() =>
                      setLineItemForms((prev) => [
                        ...prev,
                        {
                          formId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          editingPoItemId: null,
                          product: "",
                          qty: 1,
                        },
                      ])
                    }
                    className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line Item
                  </Button>

                  {lineItemForms.map((form) => (
                    <div key={form.formId} className="space-y-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] p-3">
                      <Label>{form.editingPoItemId ? "Edit Quantity" : "New Line Item"}</Label>
                      <Select
                        value={form.product || undefined}
                        onValueChange={(value) =>
                          setLineItemForms((prev) =>
                            prev.map((f) => (f.formId === form.formId ? { ...f, product: value } : f)),
                          )
                        }
                        disabled={!!form.editingPoItemId}
                      >
                        <SelectTrigger className="border-[#111827]/10 rounded-lg">
                          <SelectValue placeholder="Select product from master..." />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product, idx) => {
                            const label = buildProductLabel(product);
                            if (!label) return null;
                            return (
                              <SelectItem key={`${label}-${idx}`} value={label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        min={1}
                        value={form.qty}
                        onChange={(e) =>
                          setLineItemForms((prev) =>
                            prev.map((f) =>
                              f.formId === form.formId ? { ...f, qty: Number(e.target.value) } : f,
                            ),
                          )
                        }
                        className="border-[#111827]/10 rounded-lg"
                        placeholder="Quantity"
                      />

                      <div className="flex gap-2">
                        <Button
                          onClick={() => void savePOItem(form.formId)}
                          disabled={addingItem}
                          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                        >
                          Save Line Item
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void deletePOItem(form.formId)}
                          disabled={addingItem}
                          className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
                        >
                          Delete Item
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      toast.success("Send to Supplier", {
                        description: "Email/notification integration is still a stub.",
                      })
                    }
                    className="flex-1 bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send to Supplier
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.info("Download P.O.", {
                        description: "Download export is still a stub.",
                      })
                    }
                    className="border-[#111827]/20 text-[#111827] hover:bg-[#F8FAFC]"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
