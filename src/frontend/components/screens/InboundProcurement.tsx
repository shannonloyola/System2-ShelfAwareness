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
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  blockInvalidNumberKeys,
  isPhoneValid,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  sanitizePhoneInput,
} from "../../lib/inputSanitizers";
import {
  fetchSupplierByName,
  createSupplier as createSupplierFromService,
  fetchSupplierScorecard as fetchSupplierScorecardFromService,
  fetchSuppliers,
} from "../../lib/supplierService";
import { CSVUploader } from "../CSVUploader";
import type { CSVRow } from "../../lib/csvParser";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "../ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../ui/table";

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
  risk_level?: string | null;
  risk_summary?: string | null;
}

interface LineItemForm {
  formId: string;
  editingPoItemId: string | null;
  product: string;
  qty: string;
}

interface POTemplate {
  id: string;
  name: string;
  supplier_name: string;
  expected_delivery_date: string;
  preferred_communication: string;
}

interface SupplierFormState {
  supplier_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  currency_code: string;
  lead_time_days: string;
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

const builderInputClass =
  "mt-2 rounded-lg border border-[#1A2B47]/25 bg-white shadow-sm focus-visible:border-[#00A3AD] focus-visible:ring-[#00A3AD]/20";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

const createEmptySupplierForm = (): SupplierFormState => ({
  supplier_name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  currency_code: "",
  lead_time_days: "",
});

const validateSupplierForm = (
  form: SupplierFormState,
) => {
  const errors: Partial<Record<keyof SupplierFormState, string>> =
    {};

  if (!form.supplier_name.trim()) {
    errors.supplier_name = "Supplier name is required.";
  }
  if (!form.contact_person.trim()) {
    errors.contact_person = "Contact person is required.";
  }
  if (!form.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.phone.trim()) {
    errors.phone = "Phone is required.";
  } else if (!isPhoneValid(form.phone.trim())) {
    errors.phone = "Phone number must be up to 10 digits.";
  }
  if (!form.address.trim()) {
    errors.address = "Address is required.";
  }
  if (!form.currency_code.trim()) {
    errors.currency_code = "Currency code is required.";
  } else if (
    !CURRENCY_CODE_REGEX.test(
      form.currency_code.trim().toUpperCase(),
    )
  ) {
    errors.currency_code = "Use a 3-letter code like USD.";
  }
  if (!form.lead_time_days.trim()) {
    errors.lead_time_days = "Lead time is required.";
  } else {
    const parsed = Number.parseInt(form.lead_time_days, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      errors.lead_time_days =
        "Lead time must be a positive number.";
    }
  }

  return errors;
};

export function InboundProcurement() {
  const router = useRouter();
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
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierScorecard, setSupplierScorecard] =
    useState<SupplierScorecardRow | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<string[]>(
    [],
  );
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
  const [showCreateSupplierDialog, setShowCreateSupplierDialog] =
    useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(
    createEmptySupplierForm(),
  );
  const [supplierFormErrors, setSupplierFormErrors] = useState<
    Partial<Record<keyof SupplierFormState, string>>
  >({});
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<POTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");

  // Freight quotes state
  const [showQuotes, setShowQuotes] = useState(false);
  const [quotes, setQuotes] = useState([
    { id: "1", provider: "Nippon Yusen (NYK Line)", freightType: "Sea", cost: 350000, days: 14, winner: false },
    { id: "2", provider: "Japan Airlines Cargo", freightType: "Air", cost: 620000, days: 4, winner: false }
  ]);
  const [newQuote, setNewQuote] = useState({ provider: "", freightType: "", cost: "", days: "" });

  const [loadingPOs, setLoadingPOs] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingPO, setSendingPO] = useState(false);
  const [isEditingPO, setIsEditingPO] = useState(true);
  const [importingPO, setImportingPO] = useState(false);
  
  // Import preview modal state
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [previewRows, setPreviewRows] = useState<CSVRow[]>([]);
  const [skuMismatchSet, setSkuMismatchSet] = useState<Set<string>>(new Set());
  const [checkingSkus, setCheckingSkus] = useState(false);
  const statusFlow: Record<string, string[]> = {
    draft: ["posted"],
    "pending supplier confirmation": ["posted"],
    posted: ["in-transit"],
    "in-transit": ["received"],
    received: [],
  };

  const normalizeSku = (value: string) => (value ?? "").trim().toLowerCase();

  const checkSkuMismatches = async (rows: CSVRow[]) => {
    const uniqueSkus = Array.from(
      new Set(rows.map((r) => normalizeSku(String(r.sku || ""))).filter(Boolean)),
    );

    if (uniqueSkus.length === 0) {
      setSkuMismatchSet(new Set());
      return;
    }

    setCheckingSkus(true);
    const { data, error } = await supabase
      .from("products")
      .select("sku")
      .in("sku", uniqueSkus);

    setCheckingSkus(false);

    if (error) {
      toast.error("Failed to validate SKUs", { description: error.message });
      return;
    }

    const existing = new Set((data ?? []).map((row) => normalizeSku(row.sku || "")));
    const mismatches = new Set(
      uniqueSkus.filter((sku) => !existing.has(sku)),
    );
    setSkuMismatchSet(mismatches);
  };

  const openImportPreview = async (rows: CSVRow[]) => {
    setPreviewRows(rows);
    setShowImportPreview(true);
    await checkSkuMismatches(rows);
  };

  const fetchSupplierScorecard = async (supplier: string) => {
    if (!supplier) {
      setSupplierScorecard(null);
      return;
    }

    setLoadingSupplierScorecard(true);

    try {
      const data =
        await fetchSupplierScorecardFromService(supplier);
      setSupplierScorecard(data ?? null);
    } catch (error) {
      console.error("Scorecard fetch error", error);
      setSupplierScorecard(null);
    } finally {
      setLoadingSupplierScorecard(false);
    }
  };

  const resolveSupplierDetails = useCallback(async () => {
    const normalized = supplierName.trim();
    if (!normalized) {
      throw new Error("Supplier is required");
    }

    const supplier = await fetchSupplierByName(normalized);
    if (!supplier) {
      throw new Error(
        "Supplier not found in supplier-service",
      );
    }

    setSupplierName(supplier.supplier_name);
    setSelectedSupplierId(supplier.id);
    return supplier;
  }, [supplierName]);

  const fetchSupplierOptions = useCallback(async () => {
    try {
      const suppliers = await fetchSuppliers();
      setSupplierOptions(
        suppliers.map((supplier) => supplier.supplier_name),
      );
    } catch (error) {
      console.error("Supplier list fetch error", error);
    }
  }, []);

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
    async (poId: string, status: string, resolvedSupplierName: string) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({
          po_no: poNo || null,
          supplier_name: resolvedSupplierName || null,
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
      const supplier = await resolveSupplierDetails();
      if (selectedPO?.po_id) {
        target = await updatePOHeader(
          selectedPO.po_id,
          DEFAULT_PO_STATUS,
          supplier.supplier_name,
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
              supplier_name: supplier.supplier_name,
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
    resolveSupplierDetails,
    selectedPO?.po_id,
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
      const supplier = await resolveSupplierDetails();
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
              supplier_name: supplier.supplier_name,
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
        supplier.supplier_name,
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
    resolveSupplierDetails,
    selectedPO?.po_id,
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
          supplier_name:
            (await resolveSupplierDetails()).supplier_name,
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
        setShowImportPreview(false);
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
      resolveSupplierDetails,
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
      const parsedQty = Number.parseInt(form.qty, 10);
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
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
          .update({ quantity: parsedQty })
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
              quantity: parsedQty,
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
    void fetchSupplierOptions();
  }, [
    fetchPurchaseOrders,
    fetchProducts,
    fetchSupplierOptions,
  ]);

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
    setSelectedSupplierId("");
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
    setSelectedSupplierId("");
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

  // Template management functions
  const loadTemplates = useCallback(() => {
    const saved = localStorage.getItem("po_templates");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as POTemplate[];
        setTemplates(parsed);
      } catch {
        setTemplates([]);
      }
    }
  }, []);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    if (!supplierName.trim()) {
      toast.error("Cannot save template without supplier");
      return;
    }

    const newTemplate: POTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      supplier_name: supplierName,
      expected_delivery_date: expectedDeliveryDate,
      preferred_communication: preferredCommunication,
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem("po_templates", JSON.stringify(updatedTemplates));
    
    toast.success("Template saved", {
      description: `"${newTemplate.name}" is now available in the Templates dropdown.`,
    });
    setTemplateName("");
  }, [templateName, supplierName, expectedDeliveryDate, preferredCommunication, templates]);

  const applyTemplate = useCallback((templateId: string) => {
    if (!templateId || templateId === "none") return;
    
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setSupplierName(template.supplier_name);
    setExpectedDeliveryDate(template.expected_delivery_date);
    setPreferredCommunication(template.preferred_communication);
    
    toast.success("Template applied", {
      description: `Loaded "${template.name}" template settings.`,
    });
    
    setSelectedTemplateId("");
  }, [templates]);

  // Freight quote handlers
  const addQuote = useCallback(() => {
    if (!newQuote.provider || !newQuote.freightType || !newQuote.cost || !newQuote.days) {
      toast.error("All quote fields are required");
      return;
    }
    
    setQuotes((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        provider: newQuote.provider,
        freightType: newQuote.freightType,
        cost: Number(newQuote.cost),
        days: Number(newQuote.days),
        winner: false
      }
    ]);
    setNewQuote({ provider: "", freightType: "", cost: "", days: "" });
    toast.success("Quote added");
  }, [newQuote]);

  const selectWinner = useCallback((id: string) => {
    setQuotes((prev) => prev.map((q) => ({ ...q, winner: q.id === id })));
    toast.success("Freight quote selected as winner");
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const setSupplierField = <
    K extends keyof SupplierFormState,
  >(
    key: K,
    value: SupplierFormState[K],
  ) => {
    setSupplierForm((prev) => ({
      ...prev,
      [key]:
        key === "currency_code" && typeof value === "string"
          ? value.toUpperCase()
          : key === "phone" && typeof value === "string"
            ? sanitizePhoneInput(value)
            : key === "lead_time_days" &&
                typeof value === "string"
              ? sanitizeIntegerInput(value)
          : value,
    }));
    setSupplierFormErrors((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: undefined };
    });
  };

  const handleCreateSupplier = async () => {
    const errors = validateSupplierForm(supplierForm);
    setSupplierFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingSupplier(true);
    try {
      const created = await createSupplierFromService({
        supplier_name: supplierForm.supplier_name.trim(),
        contact_person: supplierForm.contact_person.trim(),
        email: supplierForm.email.trim(),
        phone: supplierForm.phone.trim(),
        address: supplierForm.address.trim(),
        currency_code:
          supplierForm.currency_code.trim().toUpperCase(),
        lead_time_days: Number.parseInt(
          supplierForm.lead_time_days,
          10,
        ),
      });
      await fetchSupplierOptions();
      setSupplierName(created.supplier_name);
      setSelectedSupplierId(created.id);
      void fetchSupplierScorecard(created.supplier_name);
      setShowCreateSupplierDialog(false);
      setSupplierForm(createEmptySupplierForm());
      setSupplierFormErrors({});
      toast.success("Supplier created", {
        description: `${created.supplier_name} is now ready for use in the P.O. builder.`,
      });
    } catch (error) {
      toast.error("Failed to create supplier", {
        description: toErrorMessage(error),
      });
    } finally {
      setSavingSupplier(false);
    }
  };

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
        <div className="flex items-center gap-3">
          <div className="min-w-[180px]">
            <Select value={selectedTemplateId} onValueChange={applyTemplate}>
              <SelectTrigger className="border-[#111827]/20 bg-white">
                <SelectValue placeholder="Templates" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 && (
                  <SelectItem value="none" disabled>
                    No templates saved
                  </SelectItem>
                )}
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => void openBuilder()}
            className="bg-[#00A3AD] hover:bg-[#0891B2] text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New P.O.
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="bg-white border-[#111827]/10 shadow-sm h-fit self-start lg:max-h-[calc(100vh-11rem)] lg:flex lg:flex-col lg:overflow-hidden">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              Japan P.O. Management
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 lg:flex-1 lg:overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as TabFilter)
              }
              className="w-full lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
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
                      className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
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
                        <div className="space-y-3 pb-1 lg:max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-3 lg:pb-3 lg:scroll-smooth [scrollbar-gutter:stable]">
                          {tabPOs.map((po) => (
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
                                  router.push(
                                    `/po-list/${po.po_id}`,
                                  );
                                }}
                              >
                                View details &gt;
                              </Button>
                            </div>
                            </div>
                          ))}
                        </div>
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
                  list="supplier-service-options"
                  value={supplierName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSupplierName(value);
                    setSelectedSupplierId("");
                    void fetchSupplierScorecard(value);
                  }}
                  placeholder="Enter supplier name..."
                  className={builderInputClass}
                />
                <datalist id="supplier-service-options">
                  {supplierOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#6B7280]">
                    Need a new supplier? Add it here and keep building the order.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateSupplierDialog(true)}
                    className="border-[#00A3AD]/40 text-[#00A3AD] hover:bg-[#00A3AD]/10"
                  >
                    Add Supplier
                  </Button>
                </div>

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
                      supplierScorecard.risk_level === "high"
                        ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                        : supplierScorecard.risk_level === "medium"
                          ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
                        : "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                    }`}
                  >
                    <div className="font-semibold">
                      {supplierScorecard.risk_summary ??
                        "Supplier looks healthy"}
                      :{" "}
                      {formatPercent(
                        supplierScorecard.on_time_delivery_pct,
                      )}
                      % On-Time Delivery |{" "}
                      {formatPercent(
                        supplierScorecard.defect_rate,
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
                {selectedSupplierId && (
                  <div className="mt-2 text-xs text-[#6B7280]">
                    Supplier service ID: {selectedSupplierId}
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
                    className={`${builderInputClass} pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
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
                  <SelectTrigger className={builderInputClass}>
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
                <Label className="text-[#111827]">Save as Template</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Monthly JP Restock"
                  className={builderInputClass.replace("mt-2 ", "")}
                />
                <Button
                  variant="outline"
                  onClick={handleSaveTemplate}
                  className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
                >
                  Save as Template
                </Button>
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
                  onParsed={(rows) => void openImportPreview(rows)}
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
                                  qty: String(item.quantity ?? ""),
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
                            qty: "",
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
                          <SelectTrigger className={builderInputClass.replace("mt-2 ", "")}>
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
                          min="1"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={form.qty}
                          onChange={(e) =>
                            setLineItemForms((prev) =>
                              prev.map((f) =>
                                f.formId === form.formId
                                  ? {
                                      ...f,
                                      qty: sanitizeIntegerInput(
                                        e.target.value,
                                      ),
                                    }
                                  : f,
                              ),
                            )
                          }
                          onKeyDown={(e) =>
                            blockInvalidNumberKeys(e)
                          }
                          className={builderInputClass.replace("mt-2 ", "")}
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

                  <Button
                    variant="outline"
                    onClick={() => setShowQuotes(true)}
                    className="w-full border-[#111827]/20 text-[#111827]"
                  >
                    Manage Freight Quotes
                  </Button>

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

      <Dialog
        open={showCreateSupplierDialog}
        onOpenChange={(open) => {
          setShowCreateSupplierDialog(open);
          if (!open) {
            setSupplierFormErrors({});
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
            <DialogDescription>
              Add supplier details with validation before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Supplier Name</Label>
              <Input
                id="supplier-name"
                value={supplierForm.supplier_name}
                onChange={(e) =>
                  setSupplierField("supplier_name", e.target.value)
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.supplier_name}
              />
              {supplierFormErrors.supplier_name && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.supplier_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-person">Contact Person</Label>
              <Input
                id="contact-person"
                value={supplierForm.contact_person}
                onChange={(e) =>
                  setSupplierField("contact_person", e.target.value)
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.contact_person}
              />
              {supplierFormErrors.contact_person && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.contact_person}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierField("email", e.target.value)
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.email}
              />
              {supplierFormErrors.email && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input
                id="supplier-phone"
                value={supplierForm.phone}
                onChange={(e) =>
                  setSupplierField("phone", e.target.value)
                }
                inputMode="numeric"
                maxLength={10}
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.phone}
              />
              {supplierFormErrors.phone && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.phone}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="supplier-address">Address</Label>
              <Input
                id="supplier-address"
                value={supplierForm.address}
                onChange={(e) =>
                  setSupplierField("address", e.target.value)
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.address}
              />
              {supplierFormErrors.address && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.address}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-currency">Currency Code</Label>
              <Input
                id="supplier-currency"
                value={supplierForm.currency_code}
                maxLength={3}
                onChange={(e) =>
                  setSupplierField(
                    "currency_code",
                    e.target.value.replace(/[^a-zA-Z]/g, ""),
                  )
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.currency_code}
              />
              {supplierFormErrors.currency_code && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.currency_code}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-lead-time">Lead Time Days</Label>
              <Input
                id="supplier-lead-time"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={supplierForm.lead_time_days}
                onChange={(e) =>
                  setSupplierField(
                    "lead_time_days",
                    sanitizeIntegerInput(e.target.value),
                  )
                }
                onKeyDown={(e) =>
                  blockInvalidNumberKeys(e)
                }
                className={builderInputClass.replace("mt-2 ", "")}
                aria-invalid={!!supplierFormErrors.lead_time_days}
              />
              {supplierFormErrors.lead_time_days && (
                <p className="text-xs text-[#DC2626]">
                  {supplierFormErrors.lead_time_days}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateSupplierDialog(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateSupplier()}
              disabled={
                savingSupplier ||
                Object.keys(validateSupplierForm(supplierForm)).length > 0
              }
              className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
            >
              {savingSupplier ? "Saving..." : "Create Supplier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuotes} onOpenChange={setShowQuotes}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Freight Quotes</DialogTitle>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Freight Type</TableHead>
                <TableHead>Quoted Cost</TableHead>
                <TableHead>Estimated Days</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.id} className={q.winner ? "bg-[#00A3AD]/10" : ""}>
                  <TableCell>{q.provider}</TableCell>
                  <TableCell>{q.freightType}</TableCell>
                  <TableCell>₱{q.cost.toLocaleString()}</TableCell>
                  <TableCell>{q.days} days</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      onClick={() => selectWinner(q.id)} 
                      className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                    >
                      {q.winner ? "Selected" : "Select as Winner"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 space-y-3 rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC]">
            <div className="font-semibold text-[#111827]">Add New Quote</div>
            
            <div>
              <label className="text-xs font-semibold text-[#6B7280] mb-1 block">
                Logistics Provider
              </label>
              <Input 
                placeholder="Enter provider name" 
                value={newQuote.provider} 
                onChange={(e) => setNewQuote({ ...newQuote, provider: e.target.value })} 
                className="w-full border border-[#CBD5E1] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3AD]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7280] mb-1 block">
                Freight Type
              </label>
              <Select 
                value={newQuote.freightType} 
                onValueChange={(value) => setNewQuote({ ...newQuote, freightType: value })}
              >
                <SelectTrigger className="w-full border border-[#CBD5E1] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3AD]">
                  <SelectValue placeholder="Select freight type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sea">Sea</SelectItem>
                  <SelectItem value="Air">Air</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7280] mb-1 block">
                Quoted Cost
              </label>
              <Input 
                type="number" 
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00" 
                value={newQuote.cost} 
                onChange={(e) => {
                  setNewQuote({
                    ...newQuote,
                    cost: sanitizeDecimalInput(
                      e.target.value,
                      2,
                    ),
                  });
                }} 
                onKeyDown={(e) =>
                  blockInvalidNumberKeys(e, {
                    allowDecimal: true,
                  })
                }
                className="w-full border border-[#CBD5E1] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3AD]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#6B7280] mb-1 block">
                Estimated Days
              </label>
              <Input 
                type="number" 
                min={0}
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0" 
                value={newQuote.days} 
                onChange={(e) => {
                  setNewQuote({
                    ...newQuote,
                    days: sanitizeIntegerInput(
                      e.target.value,
                    ),
                  });
                }} 
                onKeyDown={(e) =>
                  blockInvalidNumberKeys(e)
                }
                className="w-full border border-[#CBD5E1] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3AD]"
              />
            </div>

            <Button 
              onClick={addQuote} 
              className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
            >
              Add Quote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Preview Modal */}
      <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#111827]">
              Import Preview
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Review parsed rows before submitting. Mismatched SKUs are highlighted in red.
            </DialogDescription>
          </DialogHeader>

          {checkingSkus ? (
            <p className="text-sm text-[#6B7280]">Checking SKUs...</p>
          ) : (
            <div className="space-y-3">
              {skuMismatchSet.size > 0 && (
                <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
                  {skuMismatchSet.size} mismatch(es) found. Fix them before submitting.
                </div>
              )}

              <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-[#6B7280]">SKU</th>
                      <th className="text-left px-4 py-2 font-semibold text-[#6B7280]">Qty</th>
                      <th className="text-left px-4 py-2 font-semibold text-[#6B7280]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const sku = normalizeSku(String(row.sku || ""));
                      const isMismatch = sku && skuMismatchSet.has(sku);
                      return (
                        <tr
                          key={`${sku}-${i}`}
                          className={`border-b ${isMismatch ? "bg-[#FEF2F2]" : ""}`}
                        >
                          <td className={`px-4 py-2 ${isMismatch ? "text-[#991B1B] font-medium" : "text-[#111827]"}`}>
                            {row.sku || "—"}
                          </td>
                          <td className="px-4 py-2 text-[#111827]">{row.qty ?? "—"}</td>
                          <td className="px-4 py-2">
                            {isMismatch ? (
                              <span className="text-xs font-semibold text-[#991B1B]">Mismatch</span>
                            ) : (
                              <span className="text-xs font-semibold text-[#166534]">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowImportPreview(false)}
                  className="border-[#111827]/20 text-[#111827]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleImportPO(previewRows)}
                  disabled={skuMismatchSet.size > 0 || importingPO}
                  className="bg-[#00A3AD] hover:bg-[#0891B2] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importingPO ? "Importing..." : "Submit Import"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
