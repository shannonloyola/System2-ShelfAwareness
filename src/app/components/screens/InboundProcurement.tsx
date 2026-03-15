import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Plus,
  Send,
  MessageCircle,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { useNavigate } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { CSVUploader } from "../CSVUploader";
import type { CSVRow } from "../../../lib/csvParser";

type TabFilter = "all" | "draft" | "posted";

interface PurchaseOrderRow {
  po_id: string;
  po_no: string | null;
  supplier_name: string | null;
  status: string | null;
  created_at: string | null;
  paid_at?: string | null;
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

interface SupplierScorecardRow {
  supplier_key: string;
  supplier_name: string;
  total_pos: number;
  approved_pos: number;
  po_approval_rate: number;
  total_receipts: number;
  clean_receipts: number;
  clean_receipt_rate: number;
  total_discrepancies: number;
  approved_discrepancies: number;
  rejected_discrepancies: number;
  avg_discrepancy_units: number;
  reliability_score: number;
  on_time_delivery_pct?: number | null;
  defect_rate?: number | null;
}

interface LineItemForm {
  formId: string;
  editingPoItemId: string | null;
  product: string;
  qty: number;
}

const DEFAULT_PO_STATUS = "Draft";

const normalizeStatus = (status: string | null) =>
  (status ?? "").trim().toLowerCase();

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
  if (!error || typeof error !== "object")
    return "Unexpected error";
  const maybe = error as {
    status?: number;
    message?: string;
    code?: string;
  };
  if (maybe.status === 401 || maybe.status === 403)
    return "No permission / check RLS";
  return maybe.message ?? maybe.code ?? "Unexpected error";
};

const includesDraftTab = (status: string | null) => {
  const normalized = normalizeStatus(status);
  return (
    normalized === "draft" ||
    normalized === "pending supplier confirmation"
  );
};

const getStatusColor = (status: string | null) => {
  const normalized = normalizeStatus(status);
  if (
    normalized === "draft" ||
    normalized === "pending supplier confirmation"
  ) {
    return "bg-[#D1D5DB] text-[#111827]";
  }
  if (normalized === "posted") return "bg-[#00A3AD] text-white";
  if (normalized === "in-transit")
    return "bg-[#1A2B47] text-white";
  if (normalized === "received")
    return "bg-[#00A3AD] text-white";
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

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "0.0";
  return Number(value).toFixed(1);
};

const getOnTimeDeliveryPct = (
  scorecard: SupplierScorecardRow | null,
) => {
  if (!scorecard) return 0;
  return Number(
    scorecard.on_time_delivery_pct ??
      scorecard.clean_receipt_rate ??
      0,
  );
};

const getDefectRate = (
  scorecard: SupplierScorecardRow | null,
) => {
  if (!scorecard) return 0;
  if (scorecard.defect_rate != null) {
    return Number(scorecard.defect_rate);
  }
  if (!scorecard.total_pos) return 0;
  return (
    (Number(scorecard.total_discrepancies ?? 0) /
      Number(scorecard.total_pos)) *
    100
  );
};

export function InboundProcurement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const [poList, setPoList] = useState<PurchaseOrderRow[]>([]);
  const [selectedPO, setSelectedPO] =
    useState<PurchaseOrderRow | null>(null);
  const [selectedPOItems, setSelectedPOItems] = useState<
    PurchaseOrderItemRow[]
  >([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [poNo, setPoNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierScorecard, setSupplierScorecard] =
    useState<SupplierScorecardRow | null>(null);
  const [
    loadingSupplierScorecard,
    setLoadingSupplierScorecard,
  ] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] =
    useState("");
  const [preferredCommunication, setPreferredCommunication] =
    useState("");

  const [lineItemForms, setLineItemForms] = useState<
    LineItemForm[]
  >([]);

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingPO, setSendingPO] = useState(false);
  const [isEditingPO, setIsEditingPO] = useState(true);
  const [importingPO, setImportingPO] = useState(false);
  const statusFlow: Record<string, string[]> = {
    draft: ["posted"],
    "pending supplier confirmation": ["posted"],
    posted: ["in-transit"],
    "in-transit": ["received"],
    received: [],
  };

  const fetchSupplierScorecard = async (supplier: string) => {
    if (!supplier) {
      setSupplierScorecard(null);
      return;
    }

    setLoadingSupplierScorecard(true);

    const { data, error } = await supabase
      .from("supplier_scorecards_view")
      .select("*")
      .ilike("supplier_name", supplier)
      .maybeSingle();

    setLoadingSupplierScorecard(false);

    if (error) {
      console.error("Scorecard fetch error", error);
      return;
    }

    setSupplierScorecard(data ?? null);
  };

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPOs(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication",
      )
      .order("created_at", { ascending: false });
    setLoadingPOs(false);

    if (error) {
      toast.error("Failed to load purchase orders", {
        description: toErrorMessage(error),
      });
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
      toast.error("Failed to load product master", {
        description: toErrorMessage(error),
      });
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
      toast.error("Failed to load purchase order items", {
        description: toErrorMessage(error),
      });
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
      const match = value.match(
        new RegExp(`^${prefix}(\\d+)$`),
      );
      if (!match) return max;
      const n = Number(match[1]);
      if (Number.isNaN(n)) return max;
      return Math.max(max, n);
    }, 0);

    return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
  }, []);

  const updatePOHeader = useCallback(
    async (poId: string, status: string) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          po_no: poNo || null,
          supplier_name: supplierName.trim() || null,
          expected_delivery_date: expectedDeliveryDate || null,
          preferred_communication:
            preferredCommunication || null,
          status,
        })
        .eq("po_id", poId)
        .select(
          "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication",
        )
        .single();

      if (error || !data)
        throw error ?? new Error("Update failed");
      return data as PurchaseOrderRow;
    },
    [
      expectedDeliveryDate,
      poNo,
      preferredCommunication,
      supplierName,
    ],
  );

  const saveToDraft = useCallback(async () => {
    if (!supplierName.trim()) {
      toast.error("Cannot save draft", {
        description: "Supplier is required",
      });
      return;
    }

    setSavingDraft(true);
    try {
      let target: PurchaseOrderRow;
      if (selectedPO?.po_id) {
        target = await updatePOHeader(
          selectedPO.po_id,
          DEFAULT_PO_STATUS,
        );
      } else {
        const generatedPoNo =
          poNo || (await generateUniquePONumber());
        if (!poNo) setPoNo(generatedPoNo);
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("purchase_orders")
          .insert([
            {
              po_no: generatedPoNo,
              supplier_name: supplierName.trim(),
              status: DEFAULT_PO_STATUS,
              created_at: nowIso,
              paid_at: nowIso,
              expected_delivery_date:
                expectedDeliveryDate || null,
              preferred_communication:
                preferredCommunication || null,
            },
          ])
          .select(
            "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication",
          )
          .single();

        if (error || !data)
          throw error ?? new Error("Insert failed");
        target = data as PurchaseOrderRow;
      }

      setSelectedPO(target);
      await fetchPurchaseOrders();
      await fetchPOItems(target.po_id);
      toast.success("Saved to drafts", {
        description: `${target.po_no ?? "Purchase order"} is now in Drafts.`,
      });
    } catch (error) {
      toast.error("Failed to save draft", {
        description: toErrorMessage(error),
      });
    } finally {
      setSavingDraft(false);
    }
  }, [
    expectedDeliveryDate,
    fetchPOItems,
    fetchPurchaseOrders,
    generateUniquePONumber,
    poNo,
    preferredCommunication,
    selectedPO?.po_id,
    supplierName,
    updatePOHeader,
  ]);

  const sendToSupplier = useCallback(async () => {
    if (!supplierName.trim()) {
      toast.error("Cannot send purchase order", {
        description: "Supplier is required",
      });
      return;
    }

    setSendingPO(true);
    try {
      let targetPoId = selectedPO?.po_id ?? "";
      if (!targetPoId) {
        const generatedPoNo =
          poNo || (await generateUniquePONumber());
        if (!poNo) setPoNo(generatedPoNo);
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from("purchase_orders")
          .insert([
            {
              po_no: generatedPoNo,
              supplier_name: supplierName.trim(),
              status: DEFAULT_PO_STATUS,
              created_at: nowIso,
              paid_at: nowIso,
              expected_delivery_date:
                expectedDeliveryDate || null,
              preferred_communication:
                preferredCommunication || null,
            },
          ])
          .select(
            "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication",
          )
          .single();

        if (error || !data)
          throw error ?? new Error("Insert failed");
        targetPoId = data.po_id;
        setSelectedPO(data as PurchaseOrderRow);
      }

      const { count, error: countError } = await supabase
        .from("purchase_order_items")
        .select("po_item_id", { count: "exact", head: true })
        .eq("po_id", targetPoId);
      if (countError) throw countError;
      if (!count || count <= 0) {
        toast.error("Cannot send purchase order", {
          description: "Add at least one line item first",
        });
        return;
      }

      const updated = await updatePOHeader(
        targetPoId,
        "Posted",
      );
      setSelectedPO(updated);
      await fetchPurchaseOrders();
      toast.success("Sent to supplier", {
        description: `${updated.po_no ?? "Purchase order"} is now Posted.`,
      });
    } catch (error) {
      toast.error("Failed to send to supplier", {
        description: toErrorMessage(error),
      });
    } finally {
      setSendingPO(false);
    }
  }, [
    expectedDeliveryDate,
    fetchPurchaseOrders,
    generateUniquePONumber,
    poNo,
    preferredCommunication,
    selectedPO?.po_id,
    supplierName,
    updatePOHeader,
  ]);

  const handleImportPO = useCallback(
    async (rows: CSVRow[]) => {
      if (!rows || rows.length === 0) {
        toast.error("CSV has no rows to import");
        return;
      }

      const cleanedItems = rows
        .map((row) => ({
          item_name: row.sku,
          quantity: Number(row.qty),
        }))
        .filter(
          (item) =>
            item.item_name &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0,
        );

      if (cleanedItems.length === 0) {
        toast.error("No valid rows to import", {
          description: "Ensure sku and qty columns are filled.",
        });
        return;
      }

      setImportingPO(true);
      try {
        const poNumber =
          poNo || (await generateUniquePONumber());
        if (!poNo) setPoNo(poNumber);

        const payload = {
          po_no: poNumber,
          supplier_name: supplierName.trim() || "From CSV",
          expected_delivery_date: expectedDeliveryDate || null,
          preferred_communication:
            preferredCommunication || null,
          items: cleanedItems,
        };

        const { data, error } = await supabase.rpc(
          "bulk_import_po",
          { p_payload: payload },
        );
        if (error) {
          toast.error("Import failed", {
            description: toErrorMessage(error),
          });
          return;
        }

        toast.success("PO imported", {
          description: "Bulk items inserted via RPC.",
        });
        await fetchPurchaseOrders();

        // Attempt to select the newly created PO using returned UUID if present
        const newId = typeof data === "string" ? data : null;
        if (newId) {
          const match = (
            await supabase
              .from("purchase_orders")
              .select(
                "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication, paid_at",
              )
              .eq("po_id", newId)
              .single()
          ).data as PurchaseOrderRow | null;
          if (match) {
            if (!match.paid_at) {
              await supabase
                .from("purchase_orders")
                .update({ paid_at: match.created_at })
                .eq("po_id", newId);
              match.paid_at = match.created_at as string;
            }
            setSelectedPO(match);
            await fetchPOItems(match.po_id);
            setIsEditingPO(false);
            return;
          }
        }

        // Fallback: clear selection so user can pick from refreshed list
        setSelectedPO(null);
      } catch (error) {
        toast.error("Import failed", {
          description: toErrorMessage(error),
        });
      } finally {
        setImportingPO(false);
      }
    },
    [
      expectedDeliveryDate,
      fetchPOItems,
      fetchPurchaseOrders,
      generateUniquePONumber,
      poNo,
      preferredCommunication,
      supplierName,
    ],
  );

  const savePOItem = useCallback(
    async (formId: string) => {
      const form = lineItemForms.find(
        (f) => f.formId === formId,
      );
      if (!form) return;

      if (!selectedPO?.po_id) {
        toast.error("Cannot save line item", {
          description: "Select a purchase order first",
        });
        return;
      }
      if (!form.product) {
        toast.error("Cannot save line item", {
          description: "Product is required",
        });
        return;
      }
      if (!Number.isFinite(form.qty) || form.qty <= 0) {
        toast.error("Cannot save line item", {
          description: "Quantity must be greater than 0",
        });
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
          (item) =>
            (item.item_name ?? "").trim().toLowerCase() ===
            form.product.trim().toLowerCase(),
        );
        if (duplicateExists) {
          setAddingItem(false);
          toast.error("Cannot save line item", {
            description: "Duplicate line item is not allowed",
          });
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
        toast.error("Failed to save line item", {
          description: toErrorMessage(error),
        });
        return;
      }

      toast.success(
        form.editingPoItemId
          ? "Line item quantity updated"
          : "Line item added",
      );
      setLineItemForms((prev) =>
        prev.filter((f) => f.formId !== formId),
      );
      await fetchPOItems(selectedPO.po_id);
    },
    [
      fetchPOItems,
      lineItemForms,
      selectedPO?.po_id,
      selectedPOItems,
    ],
  );

  const deletePOItem = useCallback(
    async (formId: string) => {
      const form = lineItemForms.find(
        (f) => f.formId === formId,
      );
      if (!form) return;

      if (!form.editingPoItemId) {
        setLineItemForms((prev) =>
          prev.filter((f) => f.formId !== formId),
        );
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
        toast.error("Failed to delete line item", {
          description: toErrorMessage(error),
        });
        return;
      }

      toast.success("Line item deleted");
      setLineItemForms((prev) =>
        prev.filter((f) => f.formId !== formId),
      );
      await fetchPOItems(selectedPO.po_id);
    },
    [fetchPOItems, lineItemForms, selectedPO?.po_id],
  );

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

  const openBuilder = async () => {
    setSelectedPO(null);
    setIsEditingPO(true);
    setSelectedPOItems([]);
    setLineItemForms([]);
    setSupplierName("");
    setPoNo("");
    setExpectedDeliveryDate("");
    setPreferredCommunication("");
    try {
      setPoNo(await generateUniquePONumber());
    } catch (error) {
      toast.error("Failed to generate P.O. number", {
        description: toErrorMessage(error),
      });
    }
  };

  const selectPO = (po: PurchaseOrderRow) => {
    setSelectedPO(po);
    setIsEditingPO(false);
    setLineItemForms([]);
    setPoNo(po.po_no ?? "");
    setSupplierName(po.supplier_name ?? "");
    setExpectedDeliveryDate(po.expected_delivery_date ?? "");
    setPreferredCommunication(po.preferred_communication ?? "");
  };

  const updateStatus = useCallback(
    async (targetStatus: string) => {
      if (!selectedPO?.po_id) return;
      const current = normalizeStatus(selectedPO.status);
      const allowedNext = statusFlow[current] ?? [];
      if (
        !allowedNext.includes(normalizeStatus(targetStatus))
      ) {
        toast.error("Invalid status transition", {
          description: `Cannot move from "${selectedPO.status ?? "Unknown"}" to "${targetStatus}".`,
        });
        return;
      }
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({ status: targetStatus })
        .eq("po_id", selectedPO.po_id)
        .select(
          "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, preferred_communication",
        )
        .single();
      if (error || !data) {
        toast.error("Failed to update status", {
          description: toErrorMessage(error),
        });
        return;
      }
      setSelectedPO(data as PurchaseOrderRow);
      await fetchPurchaseOrders();
      toast.success("Status updated", {
        description: `${data.po_no ?? "Purchase order"} is now ${targetStatus}.`,
      });
    },
    [fetchPurchaseOrders, selectedPO, statusFlow],
  );

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Inbound Procurement & Logistics
          </h1>
          <p className="text-[#6B7280]">
            Manage purchase orders and track shipments from
            Japan
          </p>
        </div>
        <Button
          onClick={() => void openBuilder()}
          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New P.O.
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="bg-white border-[#111827]/10 shadow-sm h-fit self-start">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              Japan P.O. Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as TabFilter)
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="posted">Posted</TabsTrigger>
              </TabsList>

              {(["all", "draft", "posted"] as TabFilter[]).map(
                (tab) => {
                  const tabPOs =
                    tab === "all"
                      ? poList
                      : tab === "draft"
                        ? poList.filter((po) =>
                            includesDraftTab(po.status),
                          )
                        : poList.filter(
                            (po) =>
                              normalizeStatus(po.status) ===
                              "posted",
                          );

                  return (
                    <TabsContent
                      key={tab}
                      value={tab}
                      className="space-y-3"
                    >
                      {loadingPOs ? (
                        <div className="text-sm text-[#6B7280] p-2">
                          Loading purchase orders...
                        </div>
                      ) : tabPOs.length === 0 ? (
                        <div className="text-sm text-[#6B7280] p-2">
                          No purchase orders found.
                        </div>
                      ) : (
                        tabPOs.map((po) => (
                          <div
                            key={po.po_id}
                            onClick={() => selectPO(po)}
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                              selectedPO?.po_id === po.po_id
                                ? "border-[#00A3AD] bg-[#00A3AD]/5"
                                : "border-[#E5E7EB] hover:border-[#00A3AD]/50"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div>
                                <div className="font-semibold text-[#111827]">
                                  {po.po_no ?? "N/A"}
                                </div>
                                <div className="text-sm text-[#6B7280]">
                                  {po.supplier_name ?? "N/A"}
                                </div>
                              </div>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}
                              >
                                {po.status ?? "Unknown"}
                              </span>
                            </div>
                            <div className="text-xs text-[#6B7280]">
                              <span className="font-semibold">
                                Date Created:
                              </span>{" "}
                              {formatDate(po.created_at)}
                            </div>
                            <div className="text-xs text-[#6B7280]">
                              <span className="font-semibold">
                                Expected Delivery:
                              </span>{" "}
                              {formatDateOnly(
                                po.expected_delivery_date,
                              )}
                            </div>
                            <div className="flex justify-end mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#00A3AD] hover:text-[#0891B2]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/po-list/${po.po_id}`,
                                  );
                                }}
                              >
                                View details &gt;
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  );
                },
              )}
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              P.O. Builder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
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
                        toast.error(
                          "Failed to generate P.O. number",
                          {
                            description: toErrorMessage(error),
                          },
                        );
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setSupplierName(value);
                    fetchSupplierScorecard(value);
                  }}
                  placeholder="Enter supplier name..."
                  className="mt-2 border-[#111827]/10 rounded-lg"
                />

                {false && supplierScorecard && (
                  <div
                    className={`text-sm mt-2 ${
                      supplierScorecard.reliability_score < 70
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    Supplier Scorecard — Reliability:{" "}
                    {supplierScorecard.reliability_score}%
                  </div>
                )}

                {supplierScorecard && (
                  <div
                    className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
                      getOnTimeDeliveryPct(supplierScorecard) <
                        85 ||
                      getDefectRate(supplierScorecard) > 10
                        ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                        : "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                    }`}
                  >
                    <div className="font-semibold">
                      {getOnTimeDeliveryPct(supplierScorecard) <
                        85 ||
                      getDefectRate(supplierScorecard) > 10
                        ? "Warning"
                        : "Supplier looks healthy"}
                      :{" "}
                      {formatPercent(
                        getOnTimeDeliveryPct(supplierScorecard),
                      )}
                      % On-Time Delivery |{" "}
                      {formatPercent(
                        getDefectRate(supplierScorecard),
                      )}
                      % Defect Rate
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      Based on historical PO, GRN, and
                      discrepancy data for{" "}
                      {supplierScorecard.supplier_name}.
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>Expected Delivery Date</Label>
                <div className="relative mt-2">
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) =>
                      setExpectedDeliveryDate(e.target.value)
                    }
                    className="border-[#111827]/10 rounded-lg pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-[#6B7280] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <Label>Preferred Communication</Label>
                <Select
                  value={preferredCommunication}
                  onValueChange={setPreferredCommunication}
                >
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

              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-[#111827]">
                      Bulk import via CSV
                    </Label>
                    <p className="text-xs text-[#6B7280]">
                      Uploads call the Supabase RPC
                      bulk_import_po
                    </p>
                  </div>
                  {importingPO && (
                    <span className="text-xs text-[#00A3AD]">
                      Importing...
                    </span>
                  )}
                </div>
                <CSVUploader
                  onParsed={(rows) => void handleImportPO(rows)}
                  onError={(msg) =>
                    toast.error("CSV parse failed", {
                      description: msg,
                    })
                  }
                />
                <p className="text-xs text-[#6B7280]">
                  Required columns: sku, qty. We will
                  auto-generate the P.O. number if blank and
                  create items in one call.
                </p>
              </div>

              {selectedPO && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#6B7280]">
                      Current Status
                    </Label>
                    <div className="mt-1">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPO.status)}`}
                      >
                        {selectedPO.status ?? "Unknown"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#6B7280]">
                      Created
                    </Label>
                    <div className="text-[#111827] mt-1">
                      {formatDate(selectedPO.created_at)}
                    </div>
                  </div>
                </div>
              )}

              {selectedPO &&
                !isEditingPO &&
                includesDraftTab(selectedPO.status) && (
                  <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-3 bg-[#F8FAFC]">
                    <p className="text-sm text-[#6B7280]">
                      This purchase order is in Draft. Choose an
                      action below.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingPO(true)}
                        className="border-[#111827]/20 text-[#111827] hover:bg-[#F8FAFC] rounded-lg font-bold"
                        disabled={savingDraft || sendingPO}
                      >
                        Edit Purchase Order
                      </Button>
                      <Button
                        onClick={() => void sendToSupplier()}
                        className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg font-bold"
                        disabled={savingDraft || sendingPO}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {sendingPO
                          ? "Sending..."
                          : "Send to Supplier"}
                      </Button>
                    </div>
                  </div>
                )}

              {selectedPO &&
                !includesDraftTab(selectedPO.status) && (
                  <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-3 bg-[#F8FAFC]">
                    <p className="text-sm text-[#6B7280]">
                      Progress the order status in sequence.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={
                          !statusFlow[
                            normalizeStatus(selectedPO.status)
                          ]?.includes("in-transit")
                        }
                        onClick={() =>
                          void updateStatus("in-transit")
                        }
                        className="bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg"
                      >
                        Mark In-Transit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !statusFlow[
                            normalizeStatus(selectedPO.status)
                          ]?.includes("received")
                        }
                        onClick={() =>
                          void updateStatus("received")
                        }
                        className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
                      >
                        Mark Received
                      </Button>
                    </div>
                    {!statusFlow[
                      normalizeStatus(selectedPO.status)
                    ]?.length && (
                      <p className="text-xs text-[#6B7280]">
                        No further transitions available.
                      </p>
                    )}
                  </div>
                )}

              {(!selectedPO || isEditingPO) && (
                <>
                  <div className="space-y-3 rounded-lg border border-[#E5E7EB] p-3">
                    <Label className="text-[#6B7280]">
                      Line Items
                    </Label>
                    {loadingItems ? (
                      <div className="text-sm text-[#6B7280]">
                        Loading items...
                      </div>
                    ) : selectedPOItems.length === 0 ? (
                      <div className="text-sm text-[#6B7280]">
                        No items yet for this purchase order.
                      </div>
                    ) : (
                      selectedPOItems.map((item) => (
                        <div
                          key={item.po_item_id}
                          onClick={() => {
                            setLineItemForms((prev) => {
                              const exists = prev.some(
                                (f) =>
                                  f.editingPoItemId ===
                                  item.po_item_id,
                              );
                              if (exists) return prev;
                              return [
                                ...prev,
                                {
                                  formId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                  editingPoItemId:
                                    item.po_item_id,
                                  product: item.item_name ?? "",
                                  qty: item.quantity ?? 1,
                                },
                              ];
                            });
                          }}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            lineItemForms.some(
                              (f) =>
                                f.editingPoItemId ===
                                item.po_item_id,
                            )
                              ? "border-[#00A3AD] bg-[#00A3AD]/5"
                              : "border-[#E5E7EB] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <div className="text-sm text-[#111827]">
                            {item.item_name ?? "Unnamed item"}
                          </div>
                          <div className="text-sm font-semibold text-[#111827]">
                            Qty: {item.quantity ?? 0}
                          </div>
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
                      <div
                        key={form.formId}
                        className="space-y-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] p-3"
                      >
                        <Label>
                          {form.editingPoItemId
                            ? "Edit Quantity"
                            : "New Line Item"}
                        </Label>
                        <Select
                          value={form.product || undefined}
                          onValueChange={(value) =>
                            setLineItemForms((prev) =>
                              prev.map((f) =>
                                f.formId === form.formId
                                  ? { ...f, product: value }
                                  : f,
                              ),
                            )
                          }
                          disabled={!!form.editingPoItemId}
                        >
                          <SelectTrigger className="border-[#111827]/10 rounded-lg">
                            <SelectValue placeholder="Select product from master..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product, idx) => {
                              const label =
                                buildProductLabel(product);
                              if (!label) return null;
                              return (
                                <SelectItem
                                  key={`${label}-${idx}`}
                                  value={label}
                                >
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
                                f.formId === form.formId
                                  ? {
                                      ...f,
                                      qty: Number(
                                        e.target.value,
                                      ),
                                    }
                                  : f,
                              ),
                            )
                          }
                          className="border-[#111827]/10 rounded-lg"
                          placeholder="Quantity"
                        />

                        <div className="flex gap-2">
                          <Button
                            onClick={() =>
                              void savePOItem(form.formId)
                            }
                            disabled={addingItem}
                            className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                          >
                            Save Line Item
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              void deletePOItem(form.formId)
                            }
                            disabled={addingItem}
                            className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
                          >
                            Delete Item
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void saveToDraft()}
                      className="border-[#111827]/20 text-[#111827] hover:bg-[#F8FAFC] rounded-lg font-bold"
                      disabled={savingDraft || sendingPO}
                    >
                      {savingDraft
                        ? "Saving..."
                        : "Save to Drafts"}
                    </Button>
                    <Button
                      onClick={() => void sendToSupplier()}
                      className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg font-bold"
                      disabled={savingDraft || sendingPO}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendingPO
                        ? "Sending..."
                        : "Send to Supplier"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}