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
import { Skeleton } from "../ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router";
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
}

interface SupplierRecord {
  id: string;
  supplier_name: string;
  lead_time_days: number | null;
  status: string | null;
  currency_code?: string | null;
}

interface SupplierComparisonRow {
  supplier_id: string;
  supplier_name: string;
  rank: number;
  score: number;
  on_time_delivery: number | null;
  defect_rate: number | null;
  lead_time_days: number | null;
  status: string | null;
  risk_level: string | null;
  reliability_score: number | null;
  clean_receipt_rate: number | null;
  total_pos: number;
  total_receipts: number;
  last_audit_date: string | null;
}

type SupplierLifecycleState =
  | "Registered"
  | "Scored"
  | "Suspended";

interface MockSupplierLifecycleResponse {
  supplier_name: string;
  lifecycle_state: SupplierLifecycleState;
  locked: boolean;
  message: string;
  source: "mock";
}

interface LineItemForm {
  formId: string;
  editingPoItemId: string | null;
  product: string;
  qty: number;
}

interface POTemplate {
  id: string;
  name: string;
  supplier_name: string;
  expected_delivery_date: string;
  preferred_communication: string;
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

const formatMetricValue = (
  value: string | number | null | undefined,
  suffix = "",
) => {
  if (value == null || value === "") return "N/A";
  if (typeof value === "number") {
    return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
  }
  return `${value}${suffix}`;
};

const SUPPLIER_LIFECYCLE_SEQUENCE: SupplierLifecycleState[] = [
  "Registered",
  "Scored",
  "Suspended",
];

const MOCK_SUPPLIER_LIFECYCLE_RESPONSES: Record<
  SupplierLifecycleState,
  Omit<MockSupplierLifecycleResponse, "supplier_name">
> = {
  Registered: {
    lifecycle_state: "Registered",
    locked: false,
    message:
      "Supplier is registered in the frontend lifecycle test and can proceed to scoring.",
    source: "mock",
  },
  Scored: {
    lifecycle_state: "Scored",
    locked: false,
    message:
      "Supplier has been scored in the frontend lifecycle test and remains available for procurement actions.",
    source: "mock",
  },
  Suspended: {
    lifecycle_state: "Suspended",
    locked: true,
    message:
      "Supplier is suspended in the frontend lifecycle test. Supplier-dependent procurement actions are locked.",
    source: "mock",
  },
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
  const [supplierPanelTab, setSupplierPanelTab] =
    useState("supplier-overview");

  const [poList, setPoList] = useState<PurchaseOrderRow[]>([]);
  const [selectedPO, setSelectedPO] =
    useState<PurchaseOrderRow | null>(null);
  const [selectedPOItems, setSelectedPOItems] = useState<
    PurchaseOrderItemRow[]
  >([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  interface NewSupplierForm {
    supplier_name: string;
    contact_person: string;
    email: string;
    phone: string;
    address: string;
    currency_code: string;
    lead_time_days: string;
  }

  const [poNo, setPoNo] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [activeSupplierName, setActiveSupplierName] = useState("");

  const [newSupplierForm, setNewSupplierForm] = useState<NewSupplierForm>({
    supplier_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    currency_code: "",
    lead_time_days: "",
  });
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierRecords, setSupplierRecords] = useState<
    SupplierRecord[]
  >([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [
    selectedComparisonSupplierIds,
    setSelectedComparisonSupplierIds,
  ] = useState<string[]>([]);
  const [comparingSuppliers, setComparingSuppliers] = useState(false);
  const [
    supplierComparisonResults,
    setSupplierComparisonResults,
  ] = useState<SupplierComparisonRow[]>([]);
  const [
    supplierComparisonError,
    setSupplierComparisonError,
  ] = useState<string | null>(null);
  const [
    supplierComparisonSuccess,
    setSupplierComparisonSuccess,
  ] = useState<string | null>(null);

  const [supplierScorecard, setSupplierScorecard] =
    useState<SupplierScorecardRow | null>(null);
  const [scorecardError, setScorecardError] = useState<string | null>(null);
  const [
    loadingSupplierScorecard,
    setLoadingSupplierScorecard,
  ] = useState(false);

  interface RiskAssessmentForm {
    supplier_name: string;
    audit_date: string;
    compliance_status: string;
    findings: string;
    assessor_name: string;
    risk_notes: string;
  }

  const [riskForm, setRiskForm] = useState<RiskAssessmentForm>({
    supplier_name: "",
    audit_date: "",
    compliance_status: "",
    findings: "",
    assessor_name: "",
    risk_notes: "",
  });
  const [submittingRisk, setSubmittingRisk] = useState(false);
  const [supplierHighRisk, setSupplierHighRisk] = useState(false);

  const [supplierStatus, setSupplierStatus] = useState<string>("Active");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [
    supplierLifecycleResponse,
    setSupplierLifecycleResponse,
  ] = useState<MockSupplierLifecycleResponse | null>(null);
  const [
    mockLifecycleIndexBySupplier,
    setMockLifecycleIndexBySupplier,
  ] = useState<Record<string, number>>({});
  const [loadingSupplierLifecycle, setLoadingSupplierLifecycle] =
    useState(false);

  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [paymentPagination, setPaymentPagination] = useState<any>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1");
  const [expectedDeliveryDate, setExpectedDeliveryDate] =
    useState("");

  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  function assertSupabaseEnv() {
    if (!baseUrl || !anonKey) {
      throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    }
  }

  const functionHeaders = () => {
    assertSupabaseEnv();
    return {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    };
  };

  async function parseFunctionResponse(response: Response) {
    const raw = await response.text();
    let data: any = null;

    if (raw && raw.trim().length > 0) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON response: ${raw.slice(0, 200)}`);
      }
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        data?.message ||
        `Request failed (${response.status})${raw ? `: ${raw.slice(0, 120)}` : " with empty response"}`
      );
    }

    return data;
  }

  const [preferredCommunication, setPreferredCommunication] =
    useState("");

  const [lineItemForms, setLineItemForms] = useState<
    LineItemForm[]
  >([]);

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

  const activeSupplierKey = activeSupplierName.trim().toLowerCase();
  const supplierLifecycle =
    supplierLifecycleResponse?.lifecycle_state ?? "Registered";
  const isSupplierLocked =
    supplierLifecycleResponse?.locked ?? false;
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

  const fetchSupplierScorecard = useCallback(async (supplier: string) => {
    if (!supplier) {
      setSupplierScorecard(null);
      setScorecardError(null);
      setLoadingSupplierScorecard(false);
      return;
    }

    setScorecardError(null);
    setLoadingSupplierScorecard(true);

    try {
      const { data, error } = await supabase
        .from("supplier_scorecards_view")
        .select("*")
        .ilike("supplier_name", supplier)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setSupplierScorecard(data ?? null);
    } catch (error) {
      console.error("Scorecard fetch error", error);
      setScorecardError(toErrorMessage(error));
      setSupplierScorecard(null);
    } finally {
      setLoadingSupplierScorecard(false);
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, supplier_name, lead_time_days, status, currency_code")
      .order("supplier_name", { ascending: true });

    setLoadingSuppliers(false);

    if (error) {
      toast.error("Failed to load suppliers", {
        description: toErrorMessage(error),
      });
      setSupplierRecords([]);
      return;
    }

    setSupplierRecords((data ?? []) as SupplierRecord[]);
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

  const createSupplier = useCallback(async () => {
    setCreatingSupplier(true);

    const supplier_name = newSupplierForm.supplier_name.trim();
    const contact_person = newSupplierForm.contact_person.trim();
    const email = newSupplierForm.email.trim();
    const phone = newSupplierForm.phone.trim();
    const address = newSupplierForm.address.trim();
    const currency_code = newSupplierForm.currency_code
      .trim()
      .toUpperCase();

    const lead_time_days = Number(newSupplierForm.lead_time_days);

    if (!supplier_name) {
      toast.error("Supplier name is required");
      setCreatingSupplier(false);
      return;
    }
    if (!currency_code.match(/^[A-Z]{3}$/)) {
      toast.error("Currency code must be 3 uppercase letters, e.g. USD");
      setCreatingSupplier(false);
      return;
    }
    if (!Number.isInteger(lead_time_days) || lead_time_days <= 0) {
      toast.error("Lead time days must be a positive integer");
      setCreatingSupplier(false);
      return;
    }

    const payload = {
      supplier_name,
      contact_person: contact_person || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      currency_code,
      lead_time_days,
    };

    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert([payload])
        .select("*")
        .single();

      if (error || !data) {
        throw error ?? new Error("Insert failed");
      }

      toast.success("Supplier created successfully", {
        description: `${data.supplier_name} was added`,
      });

      void fetchSuppliers();

      setNewSupplierForm({
        supplier_name: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        currency_code: "",
        lead_time_days: "",
      });
    } catch (error) {
      toast.error("Failed to create supplier", {
        description: toErrorMessage(error),
      });
    } finally {
      setCreatingSupplier(false);
    }
  }, [fetchSuppliers, newSupplierForm]);

  const submitRiskAssessment = useCallback(async () => {
    if (isSupplierLocked) {
      toast.error("Supplier is suspended", {
        description:
          "Risk assessment submission is locked while this supplier lifecycle test is in the Suspended state.",
      });
      return;
    }

    setSubmittingRisk(true);

    const payload = {
      supplier_name: riskForm.supplier_name.trim(),
      audit_date: riskForm.audit_date,
      compliance_status: riskForm.compliance_status,
      findings: riskForm.findings.trim() || null,
      assessor_name: riskForm.assessor_name.trim(),
      risk_notes: riskForm.risk_notes.trim() || null,
    };

    if (!payload.supplier_name || !payload.audit_date || !payload.compliance_status || !payload.assessor_name) {
      toast.error("Please fill in all required fields");
      setSubmittingRisk(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("risk-assessments", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      toast.success("Risk assessment submitted", {
        description: `Assessment for ${payload.supplier_name} logged.`,
      });

      // Update high risk state if applicable
      if (data.is_high_risk) {
        setSupplierHighRisk(true);
      }

      setRiskForm({
        supplier_name: "",
        audit_date: "",
        compliance_status: "",
        findings: "",
        assessor_name: "",
        risk_notes: "",
      });
    } catch (error) {
      toast.error("Failed to submit risk assessment", {
        description: toErrorMessage(error),
      });
    } finally {
      setSubmittingRisk(false);
    }
  }, [isSupplierLocked, riskForm]);

  const updateSupplierStatus = useCallback(async (status: "Active" | "Suspended") => {
    if (!activeSupplierName.trim()) return;

    try {
      setUpdatingStatus(true);
      assertSupabaseEnv();

      const url = `${baseUrl}/functions/v1/suppliers/${encodeURIComponent(activeSupplierName.trim())}/status`;

      const response = await fetch(url, {
        method: "PUT",
        headers: functionHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await parseFunctionResponse(response);

      setSupplierStatus(data?.supplier?.status ?? status);

      toast.success("Status updated", {
        description: `${activeSupplierName} is now ${status}.`,
      });
    } catch (error) {
      toast.error("Failed to update status", {
        description: error instanceof Error ? String(error.message) : String(error),
      });
    } finally {
      setUpdatingStatus(false);
    }
  }, [activeSupplierName]);

  const fetchPaymentHistory = useCallback(async (supplier: string, page: number) => {
    if (!supplier.trim()) return;

    try {
      setLoadingPayments(true);
      assertSupabaseEnv();

      const url = `${baseUrl}/functions/v1/suppliers/${encodeURIComponent(supplier.trim())}/payments?page=${page}`;

      const response = await fetch(url, {
        method: "GET",
        headers: functionHeaders(),
      });

      const data = await parseFunctionResponse(response);

      setPaymentHistory(data?.payments ?? []);
      setPaymentPagination(
        data?.pagination ?? {
          page,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: page > 1,
        }
      );
    } catch (error) {
      toast.error("Failed to load payment history", {
        description: error instanceof Error ? String(error.message) : String(error),
      });
      setPaymentHistory([]);
    } finally {
      setLoadingPayments(false);
    }
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

  const buildMockLifecycleResponse = useCallback(
    (
      supplier: string,
      state: SupplierLifecycleState,
    ): MockSupplierLifecycleResponse => ({
      supplier_name: supplier,
      ...MOCK_SUPPLIER_LIFECYCLE_RESPONSES[state],
    }),
    [],
  );

  const loadMockSupplierLifecycle = useCallback(
    async (supplier: string) => {
      const trimmedSupplier = supplier.trim();
      if (!trimmedSupplier) {
        setSupplierLifecycleResponse(null);
        return;
      }

      setLoadingSupplierLifecycle(true);
      const supplierKey = trimmedSupplier.toLowerCase();
      const stateIndex =
        mockLifecycleIndexBySupplier[supplierKey] ?? 0;
      const state =
        SUPPLIER_LIFECYCLE_SEQUENCE[stateIndex] ?? "Registered";

      await Promise.resolve();
      setSupplierLifecycleResponse(
        buildMockLifecycleResponse(trimmedSupplier, state),
      );
      setLoadingSupplierLifecycle(false);
    },
    [buildMockLifecycleResponse, mockLifecycleIndexBySupplier],
  );

  const setMockSupplierLifecycleState = useCallback(
    async (state: SupplierLifecycleState) => {
      const supplier = activeSupplierName.trim();
      if (!supplier) {
        toast.error("Select a supplier first", {
          description:
            "Type a supplier name and press Enter before testing lifecycle transitions.",
        });
        return;
      }

      const supplierKey = supplier.toLowerCase();
      const nextIndex =
        SUPPLIER_LIFECYCLE_SEQUENCE.indexOf(state);

      setMockLifecycleIndexBySupplier((prev) => ({
        ...prev,
        [supplierKey]: nextIndex,
      }));
      setLoadingSupplierLifecycle(true);
      await Promise.resolve();
      setSupplierLifecycleResponse(
        buildMockLifecycleResponse(supplier, state),
      );
      setLoadingSupplierLifecycle(false);
    },
    [activeSupplierName, buildMockLifecycleResponse],
  );

  const advanceMockSupplierLifecycle = useCallback(async () => {
    const supplier = activeSupplierName.trim();
    if (!supplier) {
      toast.error("Select a supplier first", {
        description:
          "Type a supplier name and press Enter before advancing the lifecycle test.",
      });
      return;
    }

    const supplierKey = supplier.toLowerCase();
    const currentIndex =
      mockLifecycleIndexBySupplier[supplierKey] ?? 0;
    const nextIndex = Math.min(
      currentIndex + 1,
      SUPPLIER_LIFECYCLE_SEQUENCE.length - 1,
    );
    const nextState =
      SUPPLIER_LIFECYCLE_SEQUENCE[nextIndex];

    setMockLifecycleIndexBySupplier((prev) => ({
      ...prev,
      [supplierKey]: nextIndex,
    }));
    setLoadingSupplierLifecycle(true);
    await Promise.resolve();
    setSupplierLifecycleResponse(
      buildMockLifecycleResponse(supplier, nextState),
    );
    setLoadingSupplierLifecycle(false);
  }, [
    activeSupplierName,
    buildMockLifecycleResponse,
    mockLifecycleIndexBySupplier,
  ]);

  const toggleComparisonSupplier = useCallback(
    (supplierId: string, checked: boolean) => {
      setSelectedComparisonSupplierIds((prev) => {
        if (checked) {
          return prev.includes(supplierId)
            ? prev
            : [...prev, supplierId];
        }
        return prev.filter((id) => id !== supplierId);
      });
    },
    [],
  );

  const compareSelectedSuppliers = useCallback(async () => {
    if (selectedComparisonSupplierIds.length < 2) {
      setSupplierComparisonError(
        "Select at least two suppliers to compare.",
      );
      setSupplierComparisonSuccess(null);
      setSupplierComparisonResults([]);
      return;
    }

    try {
      setComparingSuppliers(true);
      setSupplierComparisonError(null);
      setSupplierComparisonSuccess(null);
      assertSupabaseEnv();

      const payload = {
        supplier_ids: selectedComparisonSupplierIds,
      };

      const url = `${baseUrl}/functions/v1/suppliers/compare`;
      const response = await fetch(url, {
        method: "POST",
        headers: functionHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await parseFunctionResponse(response);
      const ranked = Array.isArray(data?.ranked)
        ? (data.ranked as SupplierComparisonRow[])
        : [];

      setSupplierComparisonResults(ranked);
      setSupplierComparisonSuccess(
        ranked.length > 0
          ? `Compared ${ranked.length} suppliers using live supplier, scorecard, and risk data.`
          : null,
      );
    } catch (error) {
      setSupplierComparisonResults([]);
      setSupplierComparisonError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setComparingSuppliers(false);
    }
  }, [baseUrl, selectedComparisonSupplierIds]);

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
    if (isSupplierLocked) {
      toast.error("Supplier is suspended", {
        description:
          "Save to Drafts is locked while this supplier lifecycle test is in the Suspended state.",
      });
      return;
    }

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
    isSupplierLocked,
    updatePOHeader,
  ]);

  const sendToSupplier = useCallback(async () => {
    if (isSupplierLocked) {
      toast.error("Supplier is suspended", {
        description:
          "Send to Supplier is locked while this supplier lifecycle test is in the Suspended state.",
      });
      return;
    }

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
    isSupplierLocked,
    updatePOHeader,
  ]);

  const handleImportPO = useCallback(
    async (rows: CSVRow[]) => {
      if (isSupplierLocked) {
        toast.error("Supplier is suspended", {
          description:
            "Bulk import is locked while this supplier lifecycle test is in the Suspended state.",
        });
        return;
      }

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
      supplierName,
      isSupplierLocked,
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
    void fetchSuppliers();
  }, [fetchPurchaseOrders, fetchProducts, fetchSuppliers]);

  useEffect(() => {
    if (!selectedPO?.po_id) {
      setSelectedPOItems([]);
      return;
    }
    void fetchPOItems(selectedPO.po_id);
  }, [fetchPOItems, selectedPO?.po_id]);

  useEffect(() => {
    const supplier = supplierName.trim();
    if (!supplier) {
      setSupplierScorecard(null);
      setScorecardError(null);
      setLoadingSupplierScorecard(false);
      return;
    }

    void fetchSupplierScorecard(supplier);
  }, [supplierName, fetchSupplierScorecard]);

  useEffect(() => {
    const supplier = activeSupplierName.trim();
    if (supplier) {
      void fetchPaymentHistory(supplier, currentPage);
    } else {
      setPaymentHistory([]);
      setPaymentPagination(null);
    }
  }, [activeSupplierName, currentPage, fetchPaymentHistory]);

  useEffect(() => {
    const supplier = activeSupplierName.trim();
    if (supplier) {
      void loadMockSupplierLifecycle(supplier);
    } else {
      setSupplierLifecycleResponse(null);
      setLoadingSupplierLifecycle(false);
    }
  }, [activeSupplierName, loadMockSupplierLifecycle]);

  useEffect(() => {
    if (activeSupplierName.trim()) {
      setSearchParams({ page: "1" });
    }
  }, [activeSupplierName, setSearchParams]);

  const openBuilder = async () => {
    setSelectedPO(null);
    setIsEditingPO(true);
    setSelectedPOItems([]);
    setLineItemForms([]);
    setSupplierName("");
    setActiveSupplierName("");
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
    setActiveSupplierName(po.supplier_name ?? "");
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
    setActiveSupplierName(template.supplier_name);
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
                    setSupplierName(e.target.value);
                  }}
                  onBlur={() => {
                    setActiveSupplierName(supplierName.trim());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActiveSupplierName(supplierName.trim());
                    }
                  }}
                  placeholder="Enter supplier name..."
                  className="mt-2 border-[#111827]/10 rounded-lg"
                />

                <Tabs
                  value={supplierPanelTab}
                  onValueChange={setSupplierPanelTab}
                  className="mt-4 w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="supplier-overview">
                      Supplier Overview
                    </TabsTrigger>
                    <TabsTrigger value="supplier-comparison">
                      Supplier Comparison
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="supplier-overview"
                    className="space-y-3"
                  >

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

                <div className="mt-3">
                  {loadingSupplierScorecard ? (
                    <div className="space-y-2 rounded-lg border p-4 bg-white">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ) : scorecardError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {scorecardError}
                    </div>
                  ) : supplierScorecard ? (
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        getOnTimeDeliveryPct(supplierScorecard) < 85 ||
                        getDefectRate(supplierScorecard) > 10
                          ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                          : "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
                      }`}
                    >
                      <div className="font-semibold">
                        {getOnTimeDeliveryPct(supplierScorecard) < 85 ||
                        getDefectRate(supplierScorecard) > 10
                          ? "Warning"
                          : "Supplier looks healthy"}
                        : {formatPercent(
                          getOnTimeDeliveryPct(supplierScorecard),
                        )}
                        % On-Time Delivery | {formatPercent(
                          getDefectRate(supplierScorecard),
                        )}
                        % Defect Rate
                      </div>
                      <div className="mt-1 text-xs opacity-80">
                        Based on historical PO, GRN, and
                        discrepancy data for {supplierScorecard.supplier_name}.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm text-[#6B7280]">
                      Enter supplier name to load the scorecard.
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label className="text-[#111827] font-semibold">
                        Supplier Lifecycle
                      </Label>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        Frontend-only mock API response test for Registered, Scored, and Suspended.
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        supplierLifecycle === "Suspended"
                          ? "bg-[#FEF2F2] text-[#991B1B]"
                          : supplierLifecycle === "Scored"
                            ? "bg-[#EFF6FF] text-[#1D4ED8]"
                            : "bg-[#F3F4F6] text-[#374151]"
                      }`}
                    >
                      {loadingSupplierLifecycle
                        ? "Loading..."
                        : supplierLifecycle}
                    </span>
                  </div>

                  <div className="text-sm text-[#6B7280]">
                    {supplierLifecycleResponse?.message ??
                      "Type a supplier name and press Enter to load the mock lifecycle response."}
                  </div>

                  <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-[#6B7280]">
                    Mock response:
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[#111827]">
{JSON.stringify(
  supplierLifecycleResponse ?? {
    supplier_name: activeSupplierName.trim() || null,
    lifecycle_state: "Registered",
    locked: false,
    message:
      "Type a supplier name and press Enter to initialize the mock lifecycle response.",
    source: "mock",
  },
  null,
  2,
)}
                    </pre>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {SUPPLIER_LIFECYCLE_SEQUENCE.map((state) => (
                      <Button
                        key={state}
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void setMockSupplierLifecycleState(state)
                        }
                        className={`border-[#111827]/20 text-[#111827] ${
                          supplierLifecycle === state
                            ? "border-[#00A3AD] bg-[#00A3AD]/10 text-[#00A3AD]"
                            : ""
                        }`}
                      >
                        Mock {state}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        void advanceMockSupplierLifecycle()
                      }
                      className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
                    >
                      Advance Lifecycle
                    </Button>
                  </div>
                </div>

                {supplierHighRisk && (
                  <div className="rounded-lg border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 font-semibold">
                    ⚠️ High Risk Supplier: This supplier has been flagged as high risk based on recent compliance assessment. Proceed with caution.
                  </div>
                )}

                {isSupplierLocked && (
                  <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                    <div className="font-semibold">
                      Supplier interactions are locked
                    </div>
                    <div className="mt-1">
                      This supplier is currently in the mock Suspended lifecycle state. Supplier-dependent procurement actions are disabled until the lifecycle moves back to Registered or Scored.
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC] space-y-3">
                  <Label className="text-[#111827] font-semibold">Supplier Risk Assessment</Label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Supplier Name</Label>
                      <Input
                        value={riskForm.supplier_name}
                        onChange={(e) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            supplier_name: e.target.value,
                          }))
                        }
                        placeholder="Supplier name"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Audit Date</Label>
                      <Input
                        type="date"
                        value={riskForm.audit_date}
                        onChange={(e) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            audit_date: e.target.value,
                          }))
                        }
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label>Compliance Status</Label>
                      <Select
                        value={riskForm.compliance_status}
                        onValueChange={(value) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            compliance_status: value,
                          }))
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Compliant">Compliant</SelectItem>
                          <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
                          <SelectItem value="Under Review">Under Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Assessor Name</Label>
                      <Input
                        value={riskForm.assessor_name}
                        onChange={(e) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            assessor_name: e.target.value,
                          }))
                        }
                        placeholder="Assessor name"
                        className="mt-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Findings</Label>
                      <Input
                        value={riskForm.findings}
                        onChange={(e) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            findings: e.target.value,
                          }))
                        }
                        placeholder="Audit findings"
                        className="mt-2"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Risk Notes (Optional)</Label>
                      <Input
                        value={riskForm.risk_notes}
                        onChange={(e) =>
                          setRiskForm((prev) => ({
                            ...prev,
                            risk_notes: e.target.value,
                          }))
                        }
                        placeholder="Additional risk notes"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-3">
                    <Button
                      onClick={() => void submitRiskAssessment()}
                      disabled={submittingRisk || isSupplierLocked}
                      className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                    >
                      {submittingRisk ? "Submitting..." : "Submit Assessment"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC] space-y-3">
                  <Label className="text-[#111827] font-semibold">Supplier Status</Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[#6B7280]">Status:</span>
                    <Select
                      value={supplierStatus}
                      onValueChange={(value) => void updateSupplierStatus(value)}
                      disabled={updatingStatus || isSupplierLocked}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    {updatingStatus && <span className="text-sm text-[#00A3AD]">Updating...</span>}
                  </div>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC] space-y-3">
                  <Label className="text-[#111827] font-semibold">Payment History</Label>
                  {loadingPayments ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : paymentHistory.length === 0 ? (
                    <div className="text-sm text-[#6B7280]">No payment history found.</div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {paymentHistory.map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <div className="font-semibold">{payment.amount} {payment.currency}</div>
                              <div className="text-sm text-[#6B7280]">{formatDateOnly(payment.payment_date)}</div>
                            </div>
                            <div className="text-sm text-[#6B7280]">{payment.payment_method}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() => setSearchParams({ page: String(currentPage - 1) })}
                          disabled={!paymentPagination?.hasPrev}
                        >
                          Prev
                        </Button>
                        <span className="text-sm text-[#6B7280]">
                          Page {currentPage} of {paymentPagination?.totalPages || 1}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => setSearchParams({ page: String(currentPage + 1) })}
                          disabled={!paymentPagination?.hasNext}
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                  </TabsContent>

                  <TabsContent
                    value="supplier-comparison"
                    className="space-y-4"
                  >
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Label className="text-[#111827] font-semibold">
                            Supplier Comparison
                          </Label>
                          <p className="mt-1 text-sm text-[#6B7280]">
                            Select live supplier records, then compare them side by side using ranked scorecard and risk data.
                          </p>
                        </div>
                        <Button
                          onClick={() => void compareSelectedSuppliers()}
                          disabled={
                            comparingSuppliers ||
                            loadingSuppliers ||
                            selectedComparisonSupplierIds.length < 2
                          }
                          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                        >
                          {comparingSuppliers ? "Comparing..." : "Compare Suppliers"}
                        </Button>
                      </div>

                      {loadingSuppliers ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : supplierRecords.length === 0 ? (
                        <div className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#6B7280]">
                          No suppliers available for comparison.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {supplierRecords.map((supplier) => {
                            const checked =
                              selectedComparisonSupplierIds.includes(
                                supplier.id,
                              );

                            return (
                              <label
                                key={supplier.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                                  checked
                                    ? "border-[#00A3AD] bg-[#00A3AD]/5"
                                    : "border-[#E5E7EB] bg-white hover:border-[#00A3AD]/50"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    toggleComparisonSupplier(
                                      supplier.id,
                                      e.target.checked,
                                    )
                                  }
                                  className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#00A3AD] focus:ring-[#00A3AD]"
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#111827]">
                                    {supplier.supplier_name}
                                  </div>
                                  <div className="mt-1 text-xs text-[#6B7280]">
                                    ID: {supplier.id}
                                  </div>
                                  <div className="mt-1 text-xs text-[#6B7280]">
                                    Lead Time: {formatMetricValue(supplier.lead_time_days, " days")} | Status: {supplier.status ?? "N/A"}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <div className="text-xs text-[#6B7280]">
                        Selected suppliers: {selectedComparisonSupplierIds.length}
                      </div>

                      {supplierComparisonError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {supplierComparisonError}
                        </div>
                      )}

                      {supplierComparisonSuccess && (
                        <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">
                          {supplierComparisonSuccess}
                        </div>
                      )}
                    </div>

                    {comparingSuppliers ? (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        {Array.from({
                          length: Math.max(
                            selectedComparisonSupplierIds.length,
                            2,
                          ),
                        }).map((_, index) => (
                          <Skeleton
                            key={index}
                            className="h-64 w-full rounded-lg"
                          />
                        ))}
                      </div>
                    ) : supplierComparisonResults.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        {supplierComparisonResults.map((supplier) => (
                          <div
                            key={supplier.supplier_id}
                            className={`rounded-lg border p-4 shadow-sm ${
                              supplier.rank === 1
                                ? "border-[#00A3AD] bg-[#00A3AD]/5"
                                : "border-[#E5E7EB] bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                                  Rank #{supplier.rank}
                                </div>
                                <div className="mt-1 text-lg font-semibold text-[#111827]">
                                  {supplier.supplier_name}
                                </div>
                                <div className="mt-1 text-xs text-[#6B7280]">
                                  Supplier ID: {supplier.supplier_id}
                                </div>
                              </div>
                              <div className="rounded-full bg-[#111827] px-3 py-1 text-sm font-semibold text-white">
                                Score {formatMetricValue(supplier.score)}
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">On-Time Delivery</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.on_time_delivery, "%")}
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">Defect Rate</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.defect_rate, "%")}
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">Lead Time</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.lead_time_days, " days")}
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">Risk Level</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.risk_level)}
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">Reliability</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.reliability_score, "%")}
                                </div>
                              </div>
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <div className="text-xs text-[#6B7280]">Status</div>
                                <div className="mt-1 font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.status)}
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[#6B7280]">Clean Receipt Rate</span>
                                <span className="font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.clean_receipt_rate, "%")}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[#6B7280]">Total POs</span>
                                <span className="font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.total_pos)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[#6B7280]">Total Receipts</span>
                                <span className="font-semibold text-[#111827]">
                                  {formatMetricValue(supplier.total_receipts)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[#6B7280]">Latest Audit</span>
                                <span className="font-semibold text-[#111827]">
                                  {formatDateOnly(supplier.last_audit_date)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </TabsContent>
                </Tabs>
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
                <Label className="text-[#111827] font-semibold">Create New Supplier</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Supplier Name</Label>
                    <Input
                      value={newSupplierForm.supplier_name}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          supplier_name: e.target.value,
                        }))
                      }
                      placeholder="Supplier name"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Contact Person</Label>
                    <Input
                      value={newSupplierForm.contact_person}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          contact_person: e.target.value,
                        }))
                      }
                      placeholder="Contact person"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Email</Label>
                    <Input
                      value={newSupplierForm.email}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="Email"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={newSupplierForm.phone}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Phone"
                      className="mt-2"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={newSupplierForm.address}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                      placeholder="Address"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Currency Code</Label>
                    <Input
                      value={newSupplierForm.currency_code}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          currency_code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="USD"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Lead Time Days</Label>
                    <Input
                      value={newSupplierForm.lead_time_days}
                      onChange={(e) =>
                        setNewSupplierForm((prev) => ({
                          ...prev,
                          lead_time_days: e.target.value,
                        }))
                      }
                      placeholder="10"
                      type="number"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-3">
                  <Button
                    onClick={() => void createSupplier()}
                    disabled={creatingSupplier}
                    className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                  >
                    {creatingSupplier ? "Creating..." : "Create Supplier"}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC] space-y-3">
                <Label className="text-[#111827]">Save as Template</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Monthly JP Restock"
                  className="border-[#111827]/10 rounded-lg"
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
                        disabled={
                          savingDraft || sendingPO || isSupplierLocked
                        }
                      >
                        Edit Purchase Order
                      </Button>
                      <Button
                        onClick={() => void sendToSupplier()}
                        className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg font-bold"
                        disabled={
                          savingDraft || sendingPO || isSupplierLocked
                        }
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
                      disabled={
                        savingDraft || sendingPO || isSupplierLocked
                      }
                    >
                      {savingDraft
                        ? "Saving..."
                        : "Save to Drafts"}
                    </Button>
                    <Button
                      onClick={() => void sendToSupplier()}
                      className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white rounded-lg font-bold"
                      disabled={
                        savingDraft || sendingPO || isSupplierLocked
                      }
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
                placeholder="0.00" 
                value={newQuote.cost} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < 0) return;
                  setNewQuote({ ...newQuote, cost: e.target.value });
                }} 
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
                placeholder="0" 
                value={newQuote.days} 
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < 0) return;
                  setNewQuote({ ...newQuote, days: e.target.value });
                }} 
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
