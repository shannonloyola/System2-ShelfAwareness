import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  Clock,
  Hash,
  Package,
  Plane,
  RefreshCw,
  Ship,
  Upload,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { PerItemTracker } from "../PerItemTracker";
import {
  fetchExpiredPOs,
  fetchExpiringSoon,
  runExpirationCheck,
} from "../../../imports/expirationService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface POItem {
  po_item_id: string;
  item_name: string;
  quantity: number;
}

interface PurchaseOrder {
  po_id: string;
  po_no: string;
  supplier_name: string;
  status: string;
  created_at: string;
  expected_delivery_date: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  items: POItem[];
}

interface POStatusHistory {
  history_id: string;
  status_name: string;
  changed_at: string;
}

interface ReservationPO {
  po_id: string;
  po_no: string;
  supplier_name: string;
  status: string;
  expires_at: string;
  reserved_at: string;
}

const poRowsPerPage = 10;

type POStatusFilter =
  | "all"
  | "draft"
  | "posted"
  | "in-transit"
  | "received"
  | "pending-my-approval";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatDateOnly = (value: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const normalizeStatus = (status: string) =>
  status.trim().toLowerCase();

const normalizeOptional = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const getApprovalStatusClass = (
  status: string | null | undefined,
) => {
  const normalized = normalizeOptional(status);
  if (normalized === "approved") {
    return "bg-[#DCFCE7] text-[#166534]";
  }
  if (normalized === "rejected") {
    return "bg-[#FEE2E2] text-[#991B1B]";
  }
  return "bg-[#FEF3C7] text-[#92400E]";
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

const formatCurrency = (value: string) => {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!numeric) return "";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(numeric);
};

const parseCurrency = (value: string) =>
  Number(value.replace(/[^0-9.]/g, "")) || 0;

const getTrackerSteps = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "posted") {
    return [
      {
        label: "Pending Supplier Confirmation",
        completed: true,
        active: false,
      },
      {
        label: "Order Received",
        completed: true,
        active: false,
      },
      {
        label: "Packaging (Supplier)",
        completed: false,
        active: true,
      },
      {
        label: "Handed to Freight",
        completed: false,
        active: false,
      },
      {
        label: "Arrived at Customs (PH)",
        completed: false,
        active: false,
      },
      {
        label: "Warehouse Ready",
        completed: false,
        active: false,
      },
    ];
  }
  if (normalized === "in-transit") {
    return [
      {
        label: "Pending Supplier Confirmation",
        completed: true,
        active: false,
      },
      {
        label: "Order Received",
        completed: true,
        active: false,
      },
      {
        label: "Packaging (Supplier)",
        completed: true,
        active: false,
      },
      {
        label: "Handed to Freight",
        completed: false,
        active: true,
      },
      {
        label: "Arrived at Customs (PH)",
        completed: false,
        active: false,
      },
      {
        label: "Warehouse Ready",
        completed: false,
        active: false,
      },
    ];
  }
  if (normalized === "received") {
    return [
      {
        label: "Pending Supplier Confirmation",
        completed: true,
        active: false,
      },
      {
        label: "Order Received",
        completed: true,
        active: false,
      },
      {
        label: "Packaging (Supplier)",
        completed: true,
        active: false,
      },
      {
        label: "Handed to Freight",
        completed: true,
        active: false,
      },
      {
        label: "Arrived at Customs (PH)",
        completed: true,
        active: false,
      },
      {
        label: "Warehouse Ready",
        completed: true,
        active: false,
      },
    ];
  }
  return [
    {
      label: "Pending Supplier Confirmation",
      completed: false,
      active: true,
    },
    {
      label: "Order Received",
      completed: false,
      active: false,
    },
    {
      label: "Packaging (Supplier)",
      completed: false,
      active: false,
    },
    {
      label: "Handed to Freight",
      completed: false,
      active: false,
    },
    {
      label: "Arrived at Customs (PH)",
      completed: false,
      active: false,
    },
    {
      label: "Warehouse Ready",
      completed: false,
      active: false,
    },
  ];
};

const getStepperState = (
  step: string,
  history: POStatusHistory[],
  currentStatus: string,
) => {
  const completedStatuses = history.map((h) =>
    normalizeStatus(h.status_name),
  );
  const current = normalizeStatus(currentStatus);
  const stepNorm = normalizeStatus(step);

  if (completedStatuses.includes(stepNorm) || stepNorm === current) {
    if (stepNorm === current) {
      return "current";
    }
    return "completed";
  }
  return "pending";
};

export function PODetailPage() {
  const navigate = useNavigate();
  const { poId = "" } = useParams();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState<
    "approve" | "reject" | null
  >(null);

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(
    null,
  );
  const [statusHistory, setStatusHistory] = useState<POStatusHistory[]>([]);

  const [editEtaOpen, setEditEtaOpen] = useState(false);
  const [etaDraft, setEtaDraft] = useState("");
  const [etaReason, setEtaReason] = useState("");
  const [savingEta, setSavingEta] = useState(false);

  const [uploadingCustoms, setUploadingCustoms] = useState(false);
  const [customsDocumentUrl, setCustomsDocumentUrl] = useState<string | null>(null);

  const [postingLandedCosts, setPostingLandedCosts] = useState(false);

  // Adjust this field to your schema (example: landed_costs_posted_at)
  const landedCostsPosted = Boolean(
    (po as any)?.landed_costs_posted_at ||
    (po as any)?.landed_costs_posted
  );

  const { control, handleSubmit } = useForm({
    defaultValues: {
      fees: [{ fee_type: "", amount: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fees",
  });

  const handlePostLandedCosts = async (values: {
    fees: { fee_type: string; amount: string }[];
  }) => {
    if (!po?.po_id) return;
    if (landedCostsPosted) return;

    setPostingLandedCosts(true);
    try {
      const payload = {
        po_id: po.po_id,
        fees: values.fees.map((f) => ({
          fee_type: f.fee_type,
          amount: parseCurrency(f.amount),
        })),
      };

      // Replace RPC name + args with your actual T2 RPC signature
      const { error } = await supabase.rpc(
        "t2_post_landed_costs",
        { p_payload: payload }
      );

      if (error) {
        toast.error("Failed to post landed costs", {
          description: toErrorMessage(error),
        });
        return;
      }

      toast.success("Landed costs posted successfully");
    } finally {
      setPostingLandedCosts(false);
    }
  };

  const loadDetail = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    const [
      { data: poData, error: poError },
      { data: itemData, error: itemError },
      { data: historyData, error: historyError },
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, approval_status, approved_by, approved_at",
        )
        .eq("po_id", poId)
        .maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("po_item_id, po_id, item_name, quantity")
        .eq("po_id", poId)
        .order("po_item_id", { ascending: true }),
      supabase
        .from("po_status_history")
        .select("history_id, status_name, changed_at")
        .eq("po_id", poId)
        .order("changed_at", { ascending: false }),
    ]);
    setLoading(false);

    if (poError || !poData) {
      toast.error("Failed to load purchase order", {
        description: toErrorMessage(poError),
      });
      setPo(null);
      return;
    }
    if (itemError)
      toast.error("Failed to load line items", {
        description: toErrorMessage(itemError),
      });
    if (historyError)
      toast.error("Failed to load status history", {
        description: toErrorMessage(historyError),
      });

    setPo({
      po_id: poData.po_id,
      po_no: poData.po_no ?? "N/A",
      supplier_name: poData.supplier_name ?? "N/A",
      status: poData.status ?? "Unknown",
      created_at: poData.created_at ?? new Date().toISOString(),
      expected_delivery_date:
        poData.expected_delivery_date ?? null,
      approval_status: poData.approval_status ?? "Pending",
      approved_by: poData.approved_by ?? null,
      approved_at: poData.approved_at ?? null,
      items: (itemData ?? []).map((it) => ({
        po_item_id: it.po_item_id,
        item_name: it.item_name ?? "Unnamed item",
        quantity: it.quantity ?? 0,
      })),
    });

    setStatusHistory(historyData ?? []);
  }, [poId]);

  const handleUploadDocument = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !po) return;

    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    setUploadingDoc(true);

    const filePath = `${po.po_id}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("transit-documents")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploadingDoc(false);
      toast.error("Upload failed", {
        description: uploadError.message,
      });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("transit-documents")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    let { data: latestHistory } = await supabase
      .from("po_status_history")
      .select("history_id")
      .eq("po_id", po.po_id)
      .order("changed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestHistory) {
      const {
        data: insertedHistory,
        error: insertHistoryError,
      } = await supabase
        .from("po_status_history")
        .insert({
          po_id: po.po_id,
          status_name:
            po.status || "Pending Supplier Confirmation",
        })
        .select("history_id")
        .single();

      if (insertHistoryError || !insertedHistory) {
        setUploadingDoc(false);
        toast.error("Could not link file to status history");
        return;
      }

      latestHistory = insertedHistory;
    }

    await supabase
      .from("po_status_history")
      .update({ document_url: publicUrl })
      .eq("history_id", latestHistory.history_id);

    setUploadingDoc(false);
    setDocumentUrl(publicUrl);

    toast.success("Document uploaded successfully");
  };

  const handleUploadCustoms = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !po) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    setUploadingCustoms(true);

    const filePath = `${po.po_id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("customs_documents")
      .upload(filePath, file, { upsert: true });

    if (error) {
      setUploadingCustoms(false);
      toast.error("Upload failed", { description: error.message });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("customs_documents")
      .getPublicUrl(filePath);

    setCustomsDocumentUrl(publicUrlData.publicUrl);
    setUploadingCustoms(false);
    toast.success("Customs document uploaded");
  };

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleApprovalAction = async (
    action: "approve" | "reject",
  ) => {
    if (!po) return;

    setApprovalSubmitting(action);
    const nextStatus =
      action === "approve" ? "Approved" : "Rejected";

    const { data, error } = await supabase
      .from("purchase_orders")
      .update({
        approval_status: nextStatus,
        approved_at: new Date().toISOString(),
      })
      .eq("po_id", po.po_id)
      .select("approval_status, approved_by, approved_at")
      .single();

    setApprovalSubmitting(null);

    if (error || !data) {
      toast.error(`Failed to ${action} purchase order`, {
        description: toErrorMessage(error),
      });
      return;
    }

    setPo((current) =>
      current
        ? {
            ...current,
            approval_status: data.approval_status ?? nextStatus,
            approved_by:
              data.approved_by ?? current.approved_by,
            approved_at:
              data.approved_at ?? new Date().toISOString(),
          }
        : current,
    );

    toast.success(
      action === "approve"
        ? "Purchase order approved"
        : "Purchase order rejected",
    );
  };

  const saveEta = async () => {
    if (!po) return;
    if (!etaDraft || !etaReason.trim()) {
      toast.error("Date and reason are required");
      return;
    }
    setSavingEta(true);

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({ expected_delivery_date: etaDraft })
      .eq("po_id", po.po_id);

    if (updateError) {
      setSavingEta(false);
      toast.error("Failed to update ETA");
      return;
    }

    await supabase.from("po_status_history").insert({
      po_id: po.po_id,
      status_name: "ETA Updated",
      changed_at: new Date().toISOString(),
      reason: etaReason
    });

    setSavingEta(false);
    setEditEtaOpen(false);
    toast.success("ETA updated");
    
    // Update local state
    setPo((current) =>
      current
        ? { ...current, expected_delivery_date: etaDraft }
        : current,
    );
    
    // Reload to refresh status history
    await loadDetail();
  };

  if (loading || !po) {
    return (
      <div className="p-4">
        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardContent className="py-10 text-center text-[#6B7280]">
            {loading
              ? "Loading purchase order..."
              : "Purchase order not found."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-white">
      <button
        onClick={() => navigate("/po-list")}
        className="flex items-center gap-1.5 text-sm text-[#00A3AD] hover:text-[#0891B2] font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to PO List
      </button>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-[#111827] font-bold">
            {po.po_no}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Building2 className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">
                  Supplier
                </p>
                <p className="text-sm font-semibold text-[#111827]">
                  {po.supplier_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Hash className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">
                  PO Number
                </p>
                <p className="text-sm font-semibold text-[#111827]">
                  {po.po_no}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">Status</p>
                <p className="text-sm font-semibold text-[#111827]">
                  {po.status}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">Created</p>
                <p className="text-sm font-semibold text-[#111827]">
                  {formatDate(po.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
                <div>
                  <p className="text-xs text-[#6B7280]">Expected Delivery</p>
                  <p className="text-sm font-semibold text-[#111827]">
                    {formatDateOnly(po.expected_delivery_date)}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEtaDraft(po.expected_delivery_date ?? "");
                  setEtaReason("");
                  setEditEtaOpen(true);
                }}
                className="border-[#111827]/20 text-[#111827]"
              >
                Edit ETA
              </Button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] sm:col-span-2">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">
                  Approval Status
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getApprovalStatusClass(po.approval_status)}`}
                  >
                    {po.approval_status}
                  </span>
                  {po.approved_at && (
                    <span className="text-xs text-[#6B7280]">
                      {formatDate(po.approved_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Order Status Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {["Draft", "Posted", "In-Transit", "Received"].map((step) => {
              const state = getStepperState(step, statusHistory, po.status);
              const isCompleted = state === "completed";
              const isCurrent = state === "current";

              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                      isCompleted
                        ? "bg-[#00A3AD] text-white"
                        : isCurrent
                          ? "bg-white border-2 border-[#00A3AD] text-[#00A3AD]"
                          : "bg-[#E5E7EB] text-[#6B7280]"
                    }`}
                  >
                    {step[0]}
                  </div>
                  <div
                    className={`text-[10px] sm:text-xs mt-2 text-center font-medium ${
                      isCompleted || isCurrent ? "text-[#111827]" : "text-[#6B7280]"
                    }`}
                  >
                    {step}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Purchase Approval
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#6B7280]">
            Review this purchase order and sign off if it is
            ready to move forward.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void handleApprovalAction("reject")
              }
              disabled={approvalSubmitting !== null}
              className="border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              {approvalSubmitting === "reject"
                ? "Rejecting..."
                : "Reject"}
            </Button>
            <Button
              type="button"
              onClick={() =>
                void handleApprovalAction("approve")
              }
              disabled={approvalSubmitting !== null}
              className="bg-[#16A34A] hover:bg-[#15803D] text-white"
            >
              {approvalSubmitting === "approve"
                ? "Approving..."
                : "Approve"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#00A3AD]" />
            Line Items ({po.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {po.items.length === 0 ? (
              <div className="text-sm text-[#6B7280]">
                No line items yet.
              </div>
            ) : (
              po.items.map((item) => (
                <div
                  key={item.po_item_id}
                  className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3"
                >
                  <div className="text-sm text-[#111827]">
                    {item.item_name}
                  </div>
                  <div className="text-sm font-semibold text-[#111827]">
                    Qty: {item.quantity}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#F8FAFC] border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Freight Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="air" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="air">
                <Plane className="w-4 h-4 mr-2" />
                Freight Air
              </TabsTrigger>
              <TabsTrigger value="sea">
                <Ship className="w-4 h-4 mr-2" />
                Freight Sea
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="air"
              className="text-sm text-[#6B7280]"
            >
              PO {po.po_no} is currently {po.status}. Air
              freight timeline is placeholder data.
            </TabsContent>
            <TabsContent
              value="sea"
              className="text-sm text-[#6B7280]"
            >
              PO {po.po_no} is currently {po.status}. Sea
              freight timeline is placeholder data.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Per-Order Item Status Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PerItemTracker
            poNumber={po.po_no}
            steps={getTrackerSteps(po.status)}
          />
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Shipment Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6B7280]">
            Upload BoL, Packing Lists, and other transit-stage
            PDFs.
          </p>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00A3AD] text-white cursor-pointer hover:bg-[#0891B2] transition-colors">
            <Upload className="w-4 h-4" />
            {uploadingDoc ? "Uploading..." : "Upload PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUploadDocument}
              disabled={uploadingDoc}
            />
          </label>

          {documentUrl && (
            <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC]">
              <p className="text-sm font-medium text-[#111827] mb-1">
                Uploaded Document
              </p>
              <a
                href={documentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#00A3AD] hover:underline break-all"
              >
                View uploaded PDF
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">
            Customs Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#6B7280]">
            Upload BoC clearance papers (PDF only).
          </p>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00A3AD] text-white cursor-pointer hover:bg-[#0891B2] transition-colors">
            <Upload className="w-4 h-4" />
            {uploadingCustoms ? "Uploading..." : "Upload Customs PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUploadCustoms}
              disabled={uploadingCustoms}
            />
          </label>

          {customsDocumentUrl && (
            <div className="rounded-lg border border-[#E5E7EB] p-3 bg-[#F8FAFC]">
              <p className="text-sm font-medium text-[#111827] mb-1">
                Uploaded Customs Document
              </p>
              <a
                href={customsDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#00A3AD] hover:underline break-all"
              >
                View uploaded PDF
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logistics Fees & Landed Costs Panel */}
      <div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">
              Logistics Fees & Landed Costs
            </h3>
            <p className="text-xs text-[#6B7280]">
              Encode port bills and post landed costs to trigger the T2 distribution algorithm.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ fee_type: "", amount: "" })}
            disabled={landedCostsPosted}
            className="border-[#111827]/20 text-[#111827]"
          >
            Add Fee
          </Button>
        </div>

        {landedCostsPosted && (
          <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
            Landed costs already posted. Inputs are read-only to prevent double-counting.
          </div>
        )}

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
            >
              <Controller
                control={control}
                name={`fees.${index}.fee_type`}
                render={({ field: feeField }) => (
                  <Select
                    value={feeField.value || ""}
                    onValueChange={feeField.onChange}
                    disabled={landedCostsPosted}
                  >
                    <SelectTrigger className="border-[#111827]/10 rounded-lg">
                      <SelectValue placeholder="Select fee type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customs">Customs Duty</SelectItem>
                      <SelectItem value="brokerage">Brokerage</SelectItem>
                      <SelectItem value="arrastre">Arrastre</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                      <SelectItem value="trucking">Trucking</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />

              <Controller
                control={control}
                name={`fees.${index}.amount`}
                render={({ field: amountField }) => (
                  <Input
                    {...amountField}
                    inputMode="decimal"
                    placeholder="₱0.00"
                    onBlur={(e) =>
                      amountField.onChange(formatCurrency(e.target.value))
                    }
                    onChange={(e) => amountField.onChange(e.target.value)}
                    readOnly={landedCostsPosted}
                    className="border-[#111827]/10 rounded-lg"
                  />
                )}
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => remove(index)}
                disabled={landedCostsPosted}
                className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSubmit(handlePostLandedCosts)}
            disabled={landedCostsPosted || postingLandedCosts}
            className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
          >
            {postingLandedCosts ? "Posting..." : "Post Landed Costs"}
          </Button>
        </div>
      </div>

      <Dialog open={editEtaOpen} onOpenChange={setEditEtaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Expected Delivery</DialogTitle>
          </DialogHeader>

          <Label>New Expected Delivery Date</Label>
          <Input
            type="date"
            value={etaDraft}
            onChange={(e) => setEtaDraft(e.target.value)}
          />

          <Label className="mt-3">Reason for Change</Label>
          <Textarea
            value={etaReason}
            onChange={(e) => setEtaReason(e.target.value)}
            placeholder="Required for audit trail..."
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditEtaOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveEta}
              disabled={!etaDraft || !etaReason.trim() || savingEta}
            >
              {savingEta ? "Saving..." : "Save ETA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function POList() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<POStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [expiringSoon, setExpiringSoon] = useState<
    ReservationPO[]
  >([]);
  const [expiredPOs, setExpiredPOs] = useState<ReservationPO[]>(
    [],
  );
  const [reservationLoading, setReservationLoading] =
    useState(false);
  const [runningExpiration, setRunningExpiration] =
    useState(false);
  const [lastExpirationRun, setLastExpirationRun] = useState<
    string | null
  >(null);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    const [
      { data: poData, error: poError },
      { data: itemData, error: itemError },
    ] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          "po_id, po_no, supplier_name, status, created_at, expected_delivery_date, approval_status, approved_by, approved_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("purchase_order_items")
        .select("po_item_id, po_id, item_name, quantity"),
    ]);
    setLoading(false);

    if (poError) {
      toast.error("Failed to load purchase orders", {
        description: toErrorMessage(poError),
      });
      setPos([]);
      return;
    }
    if (itemError)
      toast.error("Failed to load line item counts", {
        description: toErrorMessage(itemError),
      });

    const map = new Map<string, POItem[]>();
    (itemData ?? []).forEach((it) => {
      const list = map.get(it.po_id) ?? [];
      list.push({
        po_item_id: it.po_item_id,
        item_name: it.item_name ?? "Unnamed item",
        quantity: it.quantity ?? 0,
      });
      map.set(it.po_id, list);
    });

    setPos(
      (poData ?? []).map((po) => ({
        po_id: po.po_id,
        po_no: po.po_no ?? "N/A",
        supplier_name: po.supplier_name ?? "N/A",
        status: po.status ?? "Unknown",
        created_at: po.created_at ?? new Date().toISOString(),
        expected_delivery_date:
          po.expected_delivery_date ?? null,
        approval_status: po.approval_status ?? "Pending",
        approved_by: po.approved_by ?? null,
        approved_at: po.approved_at ?? null,
        items: map.get(po.po_id) ?? [],
      })),
    );
  }, []);

  useEffect(() => {
    void fetchPOs();
  }, [fetchPOs]);

  const fetchReservations = useCallback(async () => {
    setReservationLoading(true);
    try {
      const [soon, expired] = await Promise.all([
        fetchExpiringSoon(),
        fetchExpiredPOs(),
      ]);
      setExpiringSoon((soon as ReservationPO[]) ?? []);
      setExpiredPOs((expired as ReservationPO[]) ?? []);
    } catch (error: any) {
      toast.error("Failed to load reservations", {
        description: toErrorMessage(error),
      });
    } finally {
      setReservationLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReservations();
  }, [fetchReservations]);

  const handleRunExpirationCheck = async () => {
    setRunningExpiration(true);
    try {
      const result = await runExpirationCheck();
      setLastExpirationRun(new Date().toISOString());
      await fetchReservations();
      toast.success("Expiration check completed", {
        description:
          result.length > 0
            ? `${result.length} reservation(s) released`
            : "No expired reservations found",
      });
    } catch (error: any) {
      toast.error("Expiration check failed", {
        description: toErrorMessage(error),
      });
    } finally {
      setRunningExpiration(false);
    }
  };

  const filtered = pos.filter(
    (po) =>
      !search ||
      po.po_no.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier_name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      po.status.toLowerCase().includes(search.toLowerCase()) ||
      po.approval_status
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return filtered;
    if (statusFilter === "pending-my-approval") {
      return filtered.filter(
        (po) =>
          normalizeOptional(po.approval_status) === "pending",
      );
    }
    return filtered.filter(
      (po) => normalizeStatus(po.status) === statusFilter,
    );
  }, [filtered, statusFilter]);

  const pagedPOs = useMemo(() => {
    const start = (currentPage - 1) * poRowsPerPage;
    return statusFiltered.slice(start, start + poRowsPerPage);
  }, [statusFiltered, currentPage]);

  const totalPages = useMemo(() => {
    return Math.max(
      1,
      Math.ceil(statusFiltered.length / poRowsPerPage),
    );
  }, [statusFiltered.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="p-4 space-y-4 bg-white">
      <div>
        <h1 className="text-2xl lg:text-4xl font-semibold mb-2 text-[#111827]">
          Purchase Orders
        </h1>
        <p className="text-sm lg:text-base text-[#6B7280]">
          View and track all purchase orders
        </p>
      </div>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-[#111827] font-semibold">
              Reservation Monitor (Order Stock Hold)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchReservations()}
                disabled={reservationLoading}
                className="border-[#111827]/20 text-[#111827]"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${reservationLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={handleRunExpirationCheck}
                disabled={runningExpiration}
                className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
              >
                <Clock className="w-4 h-4 mr-1" />
                {runningExpiration
                  ? "Running..."
                  : "Run Expiration"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-[#6B7280]">
            Available = Total - Reserved. Reservations
            auto-expire after 24 hours.
            {lastExpirationRun && (
              <>
                {" "}
                Last run:{" "}
                {new Date(lastExpirationRun).toLocaleString()}.
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
              <p className="text-xs text-[#92400E]">
                Expiring Soon (2 hrs)
              </p>
              <p className="text-2xl font-bold text-[#B45309]">
                {expiringSoon.length}
              </p>
            </div>
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
              <p className="text-xs text-[#991B1B]">
                Expired Reservations
              </p>
              <p className="text-2xl font-bold text-[#B91C1C]">
                {expiredPOs.length}
              </p>
            </div>
          </div>

          {reservationLoading ? (
            <p className="text-sm text-[#6B7280]">
              Loading reservation data...
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#6B7280] uppercase">
                  Expiring Soon
                </p>
                {expiringSoon.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">
                    No reservations expiring soon.
                  </p>
                ) : (
                  expiringSoon.slice(0, 5).map((po) => (
                    <div
                      key={po.po_id}
                      className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[#111827]">
                        {po.po_no}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {po.supplier_name}
                      </p>
                      <p className="text-xs text-[#92400E]">
                        Expires:{" "}
                        {new Date(
                          po.expires_at,
                        ).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#6B7280] uppercase">
                  Expired (Released)
                </p>
                {expiredPOs.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">
                    No expired reservations.
                  </p>
                ) : (
                  expiredPOs.slice(0, 5).map((po) => (
                    <div
                      key={po.po_id}
                      className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[#7F1D1D]">
                        {po.po_no}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {po.supplier_name}
                      </p>
                      <p className="text-xs text-[#991B1B]">
                        Expired:{" "}
                        {new Date(
                          po.expires_at,
                        ).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs text-[#1E3A8A] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              This monitor depends on DB functions
              (`reserve_product_stock`, `expire_reservations`)
              and fields (`reserved_at`, `expires_at`) on
              `purchase_orders`.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-[#111827] font-semibold">
              PO List
              {!loading && (
                <span className="ml-2 text-sm font-normal text-[#6B7280]">
                  {statusFiltered.length} order
                  {statusFiltered.length !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search PO No., supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm border border-[#111827]/10 rounded-md px-3 py-1.5 w-52 focus:outline-none focus:border-[#00A3AD]"
              />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as any)
                }
                className="text-sm border border-[#111827]/10 rounded-md px-2 py-1.5 focus:outline-none focus:border-[#00A3AD]"
              >
                <option value="all">All statuses</option>
                <option value="pending-my-approval">
                  Pending My Approval
                </option>
                <option value="draft">Draft</option>
                <option value="posted">Posted</option>
                <option value="in-transit">In-Transit</option>
                <option value="received">Received</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchPOs()}
                disabled={loading}
                className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[#E5E7EB] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">
                    PO No.
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">
                    Supplier
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">
                    Date Created
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">
                    Expected Delivery
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-[#6B7280]">
                    Items
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && pos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-[#6B7280]"
                    >
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : statusFiltered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-[#6B7280]"
                    >
                      {search
                        ? "No purchase orders match your search."
                        : "No purchase orders found."}
                    </td>
                  </tr>
                ) : (
                  pagedPOs.map((po, i) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const eta = po.expected_delivery_date ? new Date(`${po.expected_delivery_date}T00:00:00`) : null;
                    if (eta) eta.setHours(0, 0, 0, 0);
                    const isReceived = normalizeStatus(po.status) === "received";
                    const isDelayed = eta && eta < today && !isReceived;
                    
                    let badgeText = "On Track";
                    let badgeClass = "bg-[#FEF3C7] text-[#92400E]";
                    
                    if (isReceived) {
                      badgeText = "Received";
                      badgeClass = "bg-[#DCFCE7] text-[#166534]";
                    } else if (isDelayed) {
                      badgeText = "Delayed";
                      badgeClass = "bg-[#FEE2E2] text-[#991B1B]";
                    }
                    
                    return (
                      <tr
                        key={po.po_id}
                        onClick={() =>
                          navigate(`/po-list/${po.po_id}`)
                        }
                        className={`border-b border-[#E5E7EB] cursor-pointer transition-colors hover:bg-[#F0FAFA] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[#111827] whitespace-nowrap">
                          {po.po_no}
                        </td>
                        <td className="px-4 py-3 text-[#111827]">
                          {po.supplier_name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[#6B7280]">{po.status}</span>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                              {badgeText}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">
                          {formatDate(po.created_at)}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">
                          {formatDateOnly(
                            po.expected_delivery_date,
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[#6B7280]">
                          {po.items.length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-[#00A3AD] font-semibold hover:underline">
                            View details &gt;
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="text-xs text-[#6B7280]">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[#111827]/20 text-[#111827]"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.max(1, prev - 1),
                  )
                }
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-[#111827]/20 text-[#111827]"
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(totalPages, prev + 1),
                  )
                }
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}