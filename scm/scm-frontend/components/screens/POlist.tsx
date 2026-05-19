"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Circle,
  Clock,
  FileDown,
  Hash,
  Package,
  RefreshCw,
  QrCode,
  Truck,
  Upload,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useParams, useRouter } from "next/navigation";
import { QRLabelModal } from "../shared/QRLabelModal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { supabase, supabaseSCM, supabaseFulfillment } from "@/lib/supabase";
import { PerItemTracker } from "../PerItemTracker";
import {
  fetchExpiredPOs,
  fetchExpiringSoon,
  runExpirationCheck,
} from "@/imports/expirationService";
import {
  fetchPurchaseOrderById,
  fetchFreightQuotes,
  fetchPurchaseOrderItems,
  fetchPurchaseOrders,
  fetchPurchaseOrderStatusHistory,
  updatePurchaseOrderTransitStatus,
  updatePurchaseOrderApproval,
  updatePurchaseOrderEta,
  updatePurchaseOrderLatestDocument,
} from "@/lib/procurementService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

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
  is_late: boolean;
  customs_entry_date?: string | null;
  customs_release_date?: string | null;
  duties_paid?: number | null;
  transit_status?: string | null;
  transit_updated_at?: string | null;
  transit_updated_by?: string | null;
  transit_notes?: string | null;
  carrier_name?: string | null;
  carrier_tracking_ref?: string | null;
  freight_mode?: string | null;
  freight_cost?: number | null;
  freight_type?: string | null;
  item_count?: number;
  items: POItem[];
}

interface FreightQuote {
  id: string;
  provider: string;
  freight_type: string;
  cost: number;
  estimated_days: number;
  is_winner: boolean;
}

interface DeliverySchedule {
  id: string;
  delivery_datetime: string;
  warehouse_location: string;
  contact_person_name: string | null;
  contact_phone: string | null;
  status: string;
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

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

const formatPhpAmount = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(value));
};

const getFreightMode = (po: PurchaseOrder | null) =>
  (po?.freight_mode ?? "").trim();

const getTransitSteps = (freightMode: string | null | undefined) => {
  const normalized = normalizeOptional(freightMode);
  if (normalized === "air" || normalized === "sea") {
    return [
      "pending",
      "confirmed",
      "dispatched",
      "in_transit",
      "arrived_port",
      "customs_clearance",
      "customs_released",
      "out_for_delivery",
      "arrived_warehouse",
      "received",
    ];
  }
  return [
    "pending",
    "confirmed",
    "dispatched",
    "in_transit",
    "out_for_delivery",
    "arrived_warehouse",
    "received",
  ];
};

const transitStepLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  arrived_port: "Arrived at Port",
  customs_clearance: "Customs Clearance",
  customs_released: "Customs Released",
  out_for_delivery: "Out for Delivery",
  arrived_warehouse: "Arrived at Warehouse",
  received: "Received",
};

const getCurrentTransitStepIndex = (
  transitStatus: string | null | undefined,
  steps: string[],
) => {
  const normalized = normalizeOptional(transitStatus) || "pending";
  const currentIndex = steps.indexOf(normalized);
  return currentIndex >= 0 ? currentIndex : 0;
};

const getNextTransitOptions = (
  transitStatus: string | null | undefined,
  freightMode: string | null | undefined,
) => {
  const steps = getTransitSteps(freightMode);
  const currentIndex = getCurrentTransitStepIndex(transitStatus, steps);
  return steps.slice(currentIndex + 1, currentIndex + 2);
};

const getFreightModeBadgeClass = (freightMode: string | null | undefined) => {
  const normalized = normalizeOptional(freightMode);
  if (normalized === "air") return "bg-sky-100 text-sky-700 border-sky-200";
  if (normalized === "sea") return "bg-teal-100 text-teal-700 border-teal-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
};

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

function QRPrintModal({ open, onOpenChange, po }: { open: boolean; onOpenChange: (open: boolean) => void; po: PurchaseOrder & { trackingNumber?: string } }) {
  const [modalItems, setModalItems] = useState<any[]>([]);

  useEffect(() => {
    if (!po?.po_id) {
      setModalItems([]);
      return;
    }

    let active = true;
    const loadModalItems = async () => {
      try {
        const itemData = await fetchPurchaseOrderItems(po.po_id);
        if (!active) return;

        const itemsWithSku = await Promise.all(
          (itemData ?? []).map(async (it: any) => {
            const { data: prodData } = await supabaseSCM
              .from("products")
              .select("sku")
              .eq("product_name", it.item_name)
              .maybeSingle();
            return {
              sku: prodData?.sku || `SKU-${it.item_name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8)}`,
              name: it.item_name,
              quantity: it.quantity,
            };
          })
        );

        setModalItems(itemsWithSku);
      } catch (err) {
        console.error("Failed to load modal items:", err);
      }
    };

    void loadModalItems();
    return () => {
      active = false;
    };
  }, [po]);

  const trackingNum = po.trackingNumber || (po as any).tracking_number || "";

  return (
    <QRLabelModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      qrValue={trackingNum}
      title={trackingNum}
      subtitle="Fulfillment Shipment Label"
      fields={[
        { label: "TRACKING NUMBER", value: trackingNum },
        { label: "PO NUMBER", value: po.po_no },
        { label: "SUPPLIER NAME", value: po.supplier_name },
        { label: "EXPECTED ITEMS", value: `${modalItems.reduce((sum, item) => sum + item.quantity, 0)} units` },
        { label: "GENERATION TIME", value: new Date().toLocaleString() },
      ]}
      items={modalItems}
    />
  );
}

export function PODetailPage() {
  const router = useRouter();
  const params = useParams<{ poId?: string | string[] }>();
  const poId = Array.isArray(params?.poId)
    ? (params.poId[0] ?? "")
    : (params?.poId ?? "");
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalSubmitting, setApprovalSubmitting] = useState<
    "approve" | "reject" | null
  >(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [shipmentTracking, setShipmentTracking] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

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
  const [freightQuotes, setFreightQuotes] = useState<FreightQuote[]>([]);
  const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);
  const [transitDialogOpen, setTransitDialogOpen] = useState(false);
  const [savingTransit, setSavingTransit] = useState(false);
  const [transitStatusDraft, setTransitStatusDraft] = useState("");
  const [transitNotesDraft, setTransitNotesDraft] = useState("");
  const [carrierNameDraft, setCarrierNameDraft] = useState("");
  const [carrierTrackingDraft, setCarrierTrackingDraft] = useState("");
  const [savingCustoms, setSavingCustoms] = useState(false);
  const [customsEntryDraft, setCustomsEntryDraft] = useState("");
  const [customsReleaseDraft, setCustomsReleaseDraft] = useState("");
  const [dutiesPaidDraft, setDutiesPaidDraft] = useState(false);

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

      // t2_post_landed_costs lives in the Supply Chain project (supabaseSCM)
      const { error } = await supabaseSCM.rpc(
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
    try {
      const [poData, itemData, historyData] = await Promise.all([
        fetchPurchaseOrderById(poId),
        fetchPurchaseOrderItems(poId),
        fetchPurchaseOrderStatusHistory(poId),
      ]);
      const quotesPromise = fetchFreightQuotes(poId);
      const deliveryPromise = poData.supplier_name
        ? supabaseFulfillment
          .from("delivery_schedules")
          .select(
            "id, delivery_datetime, warehouse_location, contact_person_name, contact_phone, status",
          )
          .eq("supplier_name", poData.supplier_name)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      try {
        const { data: shipmentData } = await supabaseFulfillment
          .from("shipments")
          .select("tracking_number")
          .eq("po_id", poId)
          .maybeSingle();
        if (shipmentData) {
          setShipmentTracking(shipmentData.tracking_number);
        } else {
          setShipmentTracking(null);
        }
      } catch (err) {
        console.error("Failed to fetch shipment details:", err);
      }

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
        is_late: Boolean(poData.is_late),
        customs_entry_date: poData.customs_entry_date ?? null,
        customs_release_date: poData.customs_release_date ?? null,
        duties_paid: poData.duties_paid ?? null,
        transit_status: poData.transit_status ?? "pending",
        transit_updated_at: poData.transit_updated_at ?? null,
        transit_updated_by: poData.transit_updated_by ?? null,
        transit_notes: poData.transit_notes ?? null,
        carrier_name: poData.carrier_name ?? null,
        carrier_tracking_ref: poData.carrier_tracking_ref ?? null,
        freight_mode: poData.freight_mode ?? null,
        freight_cost: poData.freight_cost ?? null,
        freight_type: poData.freight_type ?? null,
        item_count: poData.item_count ?? itemData.length,
        items: (itemData ?? []).map((it) => ({
          po_item_id: it.po_item_id,
          item_name: it.item_name ?? "Unnamed item",
          quantity: it.quantity ?? 0,
        })),
      });
      setTransitStatusDraft(poData.transit_status ?? "pending");
      setTransitNotesDraft(poData.transit_notes ?? "");
      setCarrierNameDraft(poData.carrier_name ?? "");
      setCarrierTrackingDraft(poData.carrier_tracking_ref ?? "");
      setCustomsEntryDraft(
        poData.customs_entry_date
          ? poData.customs_entry_date.slice(0, 10)
          : "",
      );
      setCustomsReleaseDraft(
        poData.customs_release_date
          ? poData.customs_release_date.slice(0, 10)
          : "",
      );
      setDutiesPaidDraft(Number(poData.duties_paid ?? 0) > 0);

      setStatusHistory(
        (historyData ?? []).map((entry) => ({
          history_id: entry.history_id,
          status_name: entry.status_name ?? "Unknown",
          changed_at:
            entry.changed_at ?? new Date().toISOString(),
        })),
      );
      const [quotesData, deliveryResult] = await Promise.all([
        quotesPromise,
        deliveryPromise,
      ]);
      setFreightQuotes(
        (quotesData ?? []).map((quote) => ({
          id: quote.id,
          provider: quote.provider,
          freight_type: quote.freight_type,
          cost: Number(quote.cost),
          estimated_days: Number(quote.estimated_days),
          is_winner: Boolean(quote.is_winner),
        })),
      );
      setDeliverySchedule(deliveryResult.data ?? null);
    } catch (error) {
      toast.error("Failed to load purchase order", {
        description: toErrorMessage(error),
      });
      setPo(null);
      setFreightQuotes([]);
      setDeliverySchedule(null);
    } finally {
      setLoading(false);
    }
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

    try {
      await updatePurchaseOrderLatestDocument(po.po_id, {
        document_url: publicUrl,
        status_name:
          po.status || "Pending Supplier Confirmation",
      });
    } catch (error) {
      setUploadingDoc(false);
      toast.error("Could not link file to status history", {
        description: toErrorMessage(error),
      });
      return;
    }

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
    action: "approve",
  ) => {
    if (!po) return;

    setApprovalSubmitting(action);
    const nextStatus = "Approved";

    try {
      const data = await updatePurchaseOrderApproval(po.po_id, {
        approval_status: "Approved",
      });
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

      // Auto-create shipment record in Fulfillment database for Phase 1
      const year = new Date().getFullYear();
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const trackingNumber = `SA-${year}-${randomDigits}`;

      const expectedItems = await Promise.all(
        (po.items || []).map(async (it) => {
          const { data: prodData } = await supabaseSCM
            .from("products")
            .select("sku")
            .eq("product_name", it.item_name)
            .maybeSingle();
          return {
            sku: prodData?.sku || `SKU-${it.item_name.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8)}`,
            product_name: it.item_name,
            expected_qty: it.quantity,
          };
        })
      );

      const { error: shipmentError } = await supabaseFulfillment
        .from("shipments")
        .insert({
          shipment_id: crypto.randomUUID(),
          po_id: po.po_id,
          po_no: po.po_no,
          supplier_name: po.supplier_name,
          expected_items: expectedItems,
          status: "pending",
          tracking_number: trackingNumber,
          created_at: new Date().toISOString(),
        });

      if (shipmentError) {
        console.error("Auto-shipment creation failed:", shipmentError);
        toast.warning("Purchase order approved, but auto-shipment creation failed. Please check database columns.");
      } else {
        setShipmentTracking(trackingNumber);
        toast.success(`Purchase order approved and shipment auto-linked! (Tracking: ${trackingNumber})`);
      }

      await loadDetail();
    } catch (error) {
      toast.error(`Failed to ${action} purchase order`, {
        description: toErrorMessage(error),
      });
    } finally {
      setApprovalSubmitting(null);
    }
  };

  const handleRejectAction = async () => {
    if (!po) return;
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setRejecting(true);
    try {
      const data = await updatePurchaseOrderApproval(po.po_id, {
        approval_status: "Rejected",
        rejection_reason: rejectReason.trim(),
      });

      setPo((current) =>
        current
          ? {
            ...current,
            approval_status: data.approval_status ?? "Rejected",
            approved_by:
              data.approved_by ?? current.approved_by,
            approved_at: data.approved_at ?? null,
          }
          : current,
      );

      setShowRejectModal(false);
      setRejectReason("");
      toast.success("Purchase order rejected");
    } catch (error) {
      toast.error("Failed to reject purchase order", {
        description: toErrorMessage(error),
      });
    } finally {
      setRejecting(false);
    }
  };

  const saveEta = async () => {
    if (!po) return;
    if (!etaDraft || !etaReason.trim()) {
      toast.error("Date and reason are required");
      return;
    }
    setSavingEta(true);

    try {
      await updatePurchaseOrderEta(po.po_id, {
        expected_delivery_date: etaDraft,
        reason: etaReason.trim(),
      });

      setEditEtaOpen(false);
      toast.success("ETA updated");

      setPo((current) =>
        current
          ? { ...current, expected_delivery_date: etaDraft }
          : current,
      );

      await loadDetail();
    } catch (error) {
      setSavingEta(false);
      toast.error("Failed to update ETA", {
        description: toErrorMessage(error),
      });
      return;
    } finally {
      setSavingEta(false);
    }
  };

  const freightMode = getFreightMode(po);
  const transitSteps = getTransitSteps(freightMode);
  const currentTransitStepIndex = getCurrentTransitStepIndex(
    po?.transit_status,
    transitSteps,
  );
  const nextTransitOptions = getNextTransitOptions(
    po?.transit_status,
    freightMode,
  );
  const deliveryDate = deliverySchedule?.delivery_datetime
    ? new Date(deliverySchedule.delivery_datetime)
    : null;
  const isDeliveryOverdue = Boolean(
    deliveryDate &&
    deliveryDate.getTime() < Date.now() &&
    normalizeOptional(po.transit_status) !== "received",
  );
  const daysUntilArrival =
    deliveryDate == null
      ? null
      : Math.ceil(
        (deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

  const handleOpenTransitDialog = () => {
    const firstNextStatus = nextTransitOptions[0] ?? "";
    setTransitStatusDraft(firstNextStatus);
    setTransitNotesDraft(po.transit_notes ?? "");
    setCarrierNameDraft(po.carrier_name ?? "");
    setCarrierTrackingDraft(po.carrier_tracking_ref ?? "");
    setTransitDialogOpen(true);
  };

  const handleSaveTransitStatus = async () => {
    if (!po) return;
    if (!transitStatusDraft) {
      toast.error("Select the next transit status first");
      return;
    }

    setSavingTransit(true);
    try {
      await updatePurchaseOrderTransitStatus(po.po_id, {
        transit_status: transitStatusDraft,
        transit_updated_by: "logistics_coordinator",
        transit_notes: transitNotesDraft || null,
        carrier_name: carrierNameDraft || null,
        carrier_tracking_ref: carrierTrackingDraft || null,
      });
      setTransitDialogOpen(false);
      toast.success("Transit status updated");
      await loadDetail();
    } catch (error) {
      toast.error("Failed to update transit status", {
        description: toErrorMessage(error),
      });
    } finally {
      setSavingTransit(false);
    }
  };

  const handleSaveCustomsDetails = async () => {
    if (!po) return;
    setSavingCustoms(true);
    try {
      await updatePurchaseOrderTransitStatus(po.po_id, {
        transit_status: po.transit_status ?? "pending",
        transit_updated_by: "logistics_coordinator",
        transit_notes: po.transit_notes ?? null,
        carrier_name: po.carrier_name ?? null,
        carrier_tracking_ref: po.carrier_tracking_ref ?? null,
        customs_entry_date: customsEntryDraft || null,
        customs_release_date: customsReleaseDraft || null,
        duties_paid: dutiesPaidDraft,
      });
      toast.success("Customs details updated");
      await loadDetail();
    } catch (error) {
      toast.error("Failed to update customs details", {
        description: toErrorMessage(error),
      });
    } finally {
      setSavingCustoms(false);
    }
  };

  const handleReceiveShipment = () => {
    if (!shipmentTracking) {
      toast.error("Tracking number is not available yet");
      return;
    }

    localStorage.setItem(
      "warehouseReceivingPrefillTracking",
      shipmentTracking,
    );
    router.push(
      `/warehouse-receiving?tracking=${encodeURIComponent(shipmentTracking)}`,
    );
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
        onClick={() => router.push("/po-list")}
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
                  {po.approval_status === "Approved" && (!po.status || po.status.toLowerCase() === "draft")
                    ? "Approved"
                    : po.status}
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


      {!["approved", "rejected"].includes((po?.approval_status ?? "").toLowerCase()) && (
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
                onClick={() => setShowRejectModal(true)}
                disabled={approvalSubmitting !== null}
                className="border-[#DC2626] text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                Reject
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
      )}

      {shipmentTracking && (
        <Card className="bg-emerald-50/50 border border-emerald-200/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              Fulfillment Shipment Linked
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-emerald-700 font-medium">
              A corresponding shipment has been auto-linked in the Fulfillment database for barcode scanner processing.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                <span>Tracking Number:</span>
                <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded text-xs border border-emerald-200">{shipmentTracking}</span>
              </div>
              <div className="mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPrintModal(true)}
                  className="h-8 px-3 border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  🖨 Print QR Label
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-[#D7E4F2] bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#111827]">
                  Freight Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#6B7280]">Freight Type</span>
                  <span className="font-medium text-[#111827]">
                    {po.freight_type || "Not specified"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#6B7280]">Freight Cost</span>
                  <span className="font-semibold text-[#111827]">
                    {formatPhpAmount(po.freight_cost)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D7E4F2] bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-[#111827]">
                  Delivery Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {deliverySchedule ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#6B7280]">Expected Arrival</span>
                      <span className="font-medium text-[#111827]">
                        {formatDateTime(deliverySchedule.delivery_datetime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#6B7280]">Warehouse Location</span>
                      <span className="font-medium text-[#111827]">
                        {deliverySchedule.warehouse_location}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#6B7280]">Contact</span>
                      <span className="font-medium text-right text-[#111827]">
                        {deliverySchedule.contact_person_name || "Not specified"}
                        {deliverySchedule.contact_phone
                          ? ` • ${deliverySchedule.contact_phone}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[#6B7280]">Days Until Arrival</span>
                      <span className="font-medium text-[#111827]">
                        {daysUntilArrival == null ? "N/A" : `${daysUntilArrival} day(s)`}
                      </span>
                    </div>
                    {isDeliveryOverdue && (
                      <Badge className="w-fit bg-red-100 text-red-700 border border-red-200">
                        OVERDUE
                      </Badge>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-[#6B7280]">
                    <div className="font-medium text-[#475569]">
                      No delivery scheduled yet
                    </div>
                    <div className="mt-1 text-xs">
                      Schedule one from the Warehouse page.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#D7E4F2] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#111827]">
                Freight Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F8FAFC] text-[#6B7280]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Provider</th>
                      <th className="px-4 py-3 text-left font-semibold">Type</th>
                      <th className="px-4 py-3 text-left font-semibold">Cost</th>
                      <th className="px-4 py-3 text-left font-semibold">Days</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freightQuotes.map((quote) => (
                      <tr key={quote.id} className="border-t border-[#E5E7EB]">
                        <td className="px-4 py-3 text-[#111827]">{quote.provider}</td>
                        <td className="px-4 py-3 text-[#111827]">{quote.freight_type}</td>
                        <td className="px-4 py-3 text-[#111827]">{formatPhpAmount(quote.cost)}</td>
                        <td className="px-4 py-3 text-[#111827]">{quote.estimated_days}</td>
                        <td className="px-4 py-3">
                          {quote.is_winner ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Selected
                            </Badge>
                          ) : (
                            <span className="text-[#94A3B8]">Submitted</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {freightQuotes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-[#6B7280]">
                          No freight quotes saved yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {normalizeOptional(po.transit_status) === "arrived_warehouse" && (
            <Card className="border-emerald-200 bg-emerald-50 shadow-sm">
              <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-emerald-900">
                    Shipment has arrived at warehouse
                  </div>
                  <div className="text-sm text-emerald-800">
                    Continue directly into Warehouse Receiving with the linked tracking number.
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleReceiveShipment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Truck className="mr-2 h-4 w-4" />
                  Receive This Shipment
                </Button>
              </CardContent>
            </Card>
          )}
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

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Reject Purchase Order
            </h2>
            <p className="text-sm text-gray-500">
              Please provide a reason for rejection.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAction}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={transitDialogOpen} onOpenChange={setTransitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Transit Status</DialogTitle>
            <DialogDescription>
              Move this shipment to the next valid stage and capture any carrier notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transit-status-select">Next Status</Label>
              <Select
                value={transitStatusDraft}
                onValueChange={setTransitStatusDraft}
              >
                <SelectTrigger id="transit-status-select">
                  <SelectValue placeholder="Select next status" />
                </SelectTrigger>
                <SelectContent>
                  {nextTransitOptions.map((step) => (
                    <SelectItem key={step} value={step}>
                      {transitStepLabels[step] ?? step}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transit-notes">Notes</Label>
              <Textarea
                id="transit-notes"
                value={transitNotesDraft}
                onChange={(e) => setTransitNotesDraft(e.target.value)}
                placeholder="Optional transit note..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransitDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveTransitStatus}
                disabled={!transitStatusDraft || savingTransit}
                className="bg-[#1A2B47] hover:bg-[#24395e] text-white"
              >
                {savingTransit ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
      {showPrintModal && po && (
        <QRPrintModal
          open={showPrintModal}
          onOpenChange={setShowPrintModal}
          po={{ ...po, trackingNumber: shipmentTracking || "" }}
        />
      )}
    </div>
  );
}

export function POList() {
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [shipmentsMap, setShipmentsMap] = useState<Record<string, string>>({});
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
  const [showExpiringSoon, setShowExpiringSoon] = useState(true);
  const [showExpiredPOs, setShowExpiredPOs] = useState(true);
  const [reservationLoading, setReservationLoading] =
    useState(false);
  const [runningExpiration, setRunningExpiration] =
    useState(false);
  const [lastExpirationRun, setLastExpirationRun] = useState<
    string | null
  >(null);

  const [printPo, setPrintPo] = useState<PurchaseOrder & { trackingNumber?: string } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const poData = await fetchPurchaseOrders();

      try {
        const { data: shipmentsData } = await supabaseFulfillment
          .from("shipments")
          .select("po_id, tracking_number");

        if (shipmentsData) {
          const map: Record<string, string> = {};
          for (const s of shipmentsData) {
            if (s.po_id) {
              map[s.po_id] = s.tracking_number;
            }
          }
          setShipmentsMap(map);
        }
      } catch (err) {
        console.error("Failed to load shipments map:", err);
      }

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
          is_late: Boolean(po.is_late),
          item_count: po.item_count ?? 0,
          items: [],
        })),
      );
    } catch (error) {
      toast.error("Failed to load purchase orders", {
        description: toErrorMessage(error),
      });
      setPos([]);
    } finally {
      setLoading(false);
    }
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
              Reservation Status
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reservationLoading ? (
            <p className="text-sm text-[#6B7280]">
              Loading reservation data...
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowExpiringSoon((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#6B7280] uppercase">
                      Expiring Soon
                    </p>
                    <p className="text-sm font-semibold text-[#B45309]">
                      {expiringSoon.length}
                    </p>
                  </div>
                  {showExpiringSoon ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                {showExpiringSoon &&
                  (expiringSoon.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">
                      No reservations expiring soon.
                    </p>
                  ) : (
                    expiringSoon.map((po) => (
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
                  ))}
              </div>

              <div className="rounded-lg border border-[#E5E7EB] p-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowExpiredPOs((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#6B7280] uppercase">
                      Expired (Released)
                    </p>
                    <p className="text-sm font-semibold text-[#B91C1C]">
                      {expiredPOs.length}
                    </p>
                  </div>
                  {showExpiredPOs ? (
                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                  )}
                </button>
                {showExpiredPOs &&
                  (expiredPOs.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">
                      No expired reservations.
                    </p>
                  ) : (
                    expiredPOs.map((po) => (
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
                  ))}
              </div>
            </div>
          )}
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
                    Shipment Created
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
                      colSpan={8}
                      className="text-center py-12 text-[#6B7280]"
                    >
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : statusFiltered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-12 text-[#6B7280]"
                    >
                      {search
                        ? "No purchase orders match your search."
                        : "No purchase orders found."}
                    </td>
                  </tr>
                ) : (
                  pagedPOs.map((po, i) => {
                    const isReceived = normalizeStatus(po.status) === "received";

                    let badgeText: string | undefined = undefined;
                    let badgeClass = "";

                    if (isReceived) {
                      badgeText = "Received";
                      badgeClass = "bg-[#DCFCE7] text-[#166534]";
                    } else if (po.is_late === true) {
                      badgeText = "Delayed";
                      badgeClass = "bg-[#FEE2E2] text-[#991B1B]";
                    } else if (po.is_late === false) {
                      badgeText = "On Track";
                      badgeClass = "bg-[#FEF3C7] text-[#92400E]";
                    }

                    return (
                      <tr
                        key={po.po_id}
                        onClick={() =>
                          router.push(`/po-list/${po.po_id}`)
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
                            {badgeText && (
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                                {badgeText}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {shipmentsMap[po.po_id] ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                              <span className="text-emerald-500 font-bold">✓</span>
                              <span className="text-xs font-mono">{shipmentsMap[po.po_id]}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">—</span>
                          )}
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
                          {po.item_count ?? po.items.length}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                            {shipmentsMap[po.po_id] && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPrintPo({
                                    ...po,
                                    trackingNumber: shipmentsMap[po.po_id],
                                  });
                                  setShowPrintModal(true);
                                }}
                                className="h-8 px-2.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                              >
                                <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                                🖨 Print QR
                              </Button>
                            )}
                            <span
                              onClick={() => router.push(`/po-list/${po.po_id}`)}
                              className="text-xs text-[#00A3AD] font-semibold hover:underline cursor-pointer"
                            >
                              View details &gt;
                            </span>
                          </div>
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

      {showPrintModal && printPo && (
        <QRPrintModal
          open={showPrintModal}
          onOpenChange={setShowPrintModal}
          po={printPo}
        />
      )}
    </div>
  );
}
