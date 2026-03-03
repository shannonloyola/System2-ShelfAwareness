import { useState, useEffect } from "react";
import {
  AlertTriangle,
  TrendingDown,
  Package,
  MapPin,
  ArrowRightLeft,
  Search,
  ClipboardList,
  CheckCircle2,
  XCircle,
  FileBarChart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import {
  submitAdjustment,
  approveAdjustment,
  rejectAdjustment,
  fetchAdjustments,
  REASON_CATEGORIES,
  type StockAdjustment,
  type ReasonCategory,
} from "../../../imports/adjustmentAPI";
import { supabase } from "../../../lib/supabase";
import MovementReport from "../../../imports/movement-report";
import ValuationReport from "../../../imports/valuation-report";

interface StockItem {
  id: string;
  sku: string;
  name: string;
  location: string;
  zone: string;
  aisle: string;
  bin: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  status: "healthy" | "low" | "critical" | "overstock";
  lastRestocked: string;
}

const mockStock: StockItem[] = [
  {
    id: "1",
    sku: "AMX-500",
    name: "Amoxicillin 500mg",
    location: "Main Warehouse Manila",
    zone: "Zone A",
    aisle: "A-01",
    bin: "Bin 15",
    currentStock: 12500,
    minStock: 1000,
    maxStock: 15000,
    status: "healthy",
    lastRestocked: "2026-02-15",
  },
  {
    id: "2",
    sku: "CET-10",
    name: "Cetirizine 10mg",
    location: "Main Warehouse Manila",
    zone: "Zone A",
    aisle: "A-03",
    bin: "Bin 22",
    currentStock: 320,
    minStock: 1200,
    maxStock: 5000,
    status: "critical",
    lastRestocked: "2026-01-10",
  },
  {
    id: "3",
    sku: "MET-500",
    name: "Metformin 500mg",
    location: "Main Warehouse Manila",
    zone: "Zone A",
    aisle: "A-05",
    bin: "Bin 08",
    currentStock: 850,
    minStock: 800,
    maxStock: 4000,
    status: "low",
    lastRestocked: "2026-02-01",
  },
  {
    id: "4",
    sku: "PAR-500",
    name: "Paracetamol 500mg",
    location: "Satellite Hub Quezon City",
    zone: "Zone B",
    aisle: "B-02",
    bin: "Bin 45",
    currentStock: 18200,
    minStock: 1500,
    maxStock: 10000,
    status: "overstock",
    lastRestocked: "2026-02-18",
  },
  {
    id: "5",
    sku: "IBU-400",
    name: "Ibuprofen 400mg",
    location: "Main Warehouse Manila",
    zone: "Zone A",
    aisle: "A-02",
    bin: "Bin 18",
    currentStock: 8900,
    minStock: 800,
    maxStock: 12000,
    status: "healthy",
    lastRestocked: "2026-02-12",
  },
  {
    id: "6",
    sku: "LOS-50",
    name: "Losartan 50mg",
    location: "Satellite Hub Makati",
    zone: "Zone C",
    aisle: "C-01",
    bin: "Bin 03",
    currentStock: 450,
    minStock: 600,
    maxStock: 3000,
    status: "low",
    lastRestocked: "2026-01-28",
  },
];

const warehouseLocations = [
  "Main Warehouse Manila",
  "Satellite Hub Quezon City",
  "Satellite Hub Makati",
  "Cold Storage Facility",
];

const EMPTY_FORM = {
  product_id: 0,
  sku: "",
  product_name: "",
  qty_before: 0,
  qty_change: "",
  reason: "",
  reason_category: "Count Correction" as ReasonCategory,
  requested_by: "",
};

export function StockManagement() {
  // Inventory states
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] =
    useState<string>("all");
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [showTransferDialog, setShowTransferDialog] =
    useState(false);
  const [selectedItem, setSelectedItem] =
    useState<StockItem | null>(null);

  // Main tab state
  const [mainTab, setMainTab] = useState("inventory");

  // Stock Adjustment states
  const [adjustmentTab, setAdjustmentTab] = useState("request");
  const [adjustments, setAdjustments] = useState<
    StockAdjustment[]
  >([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalAdj, setModalAdj] =
    useState<StockAdjustment | null>(null);
  const [managerName, setManagerName] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [modalAction, setModalAction] = useState<
    "approve" | "reject" | null
  >(null);

  // Load products and adjustments when switching to adjustments tab
  useEffect(() => {
    if (mainTab === "adjustments") {
      setLoading(true);
      Promise.all([
        supabase
          .from("products")
          .select(
            "product_id, sku, product_name, inventory_on_hand",
          )
          .order("product_name")
          .then(({ data }) => setProducts(data ?? [])),
        fetchAdjustments().then(setAdjustments),
      ]).finally(() => setLoading(false));
    }
  }, [mainTab]);

  // Inventory filters
  const filteredStock = mockStock.filter((item) => {
    const keyword = searchTerm.trim().toLowerCase();
    const matchesSearch =
      keyword.length === 0 ||
      item.sku.toLowerCase().includes(keyword) ||
      item.name.toLowerCase().includes(keyword);
    const matchesLocation =
      locationFilter === "all" ||
      item.location === locationFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesLocation && matchesStatus;
  });

  const lowStockItems = mockStock.filter(
    (item) =>
      item.status === "low" || item.status === "critical",
  );
  const criticalItems = mockStock.filter(
    (item) => item.status === "critical",
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-[#00A3AD] text-white";
      case "low":
        return "bg-[#F97316] text-white";
      case "critical":
        return "bg-[#DC2626] text-white";
      case "overstock":
        return "bg-[#1A2B47] text-white";
      default:
        return "bg-[#D1D5DB] text-[#111827]";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "low" || status === "critical") {
      return <AlertTriangle className="w-4 h-4" />;
    }
    if (status === "overstock") {
      return <TrendingDown className="w-4 h-4" />;
    }
    return <Package className="w-4 h-4" />;
  };

  const handleStockTransfer = () => {
    toast.success("Stock Transfer Initiated", {
      description:
        "Transfer request has been logged and will be processed",
    });
    setShowTransferDialog(false);
    setSelectedItem(null);
  };

  // Stock Adjustment handlers
  const f = (k: string) => (e: any) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleProductChange = (value: string) => {
    const p = products.find(
      (x) => x.product_id === parseInt(value),
    );
    if (p)
      setForm((prev) => ({
        ...prev,
        product_id: p.product_id,
        sku: p.sku,
        product_name: p.product_name,
        qty_before: p.inventory_on_hand,
      }));
  };

  const handleSubmitAdjustment = async () => {
    if (
      !form.product_id ||
      !form.qty_change ||
      !form.reason ||
      !form.requested_by
    )
      return;
    setSubmitting(true);
    try {
      const result = await submitAdjustment({
        ...form,
        qty_change: parseInt(form.qty_change as any),
      });
      setAdjustments((p) => [result, ...p]);
      setForm(EMPTY_FORM);
      toast.success("Adjustment Submitted", {
        description: "Awaiting manager approval",
      });
      setAdjustmentTab("pending");
    } catch (e: any) {
      toast.error("Submission Failed", {
        description: e.message,
      });
    }
    setSubmitting(false);
  };

  const handleApprove = async () => {
    if (!modalAdj || !managerName.trim()) return;
    setSubmitting(true);
    try {
      await approveAdjustment(modalAdj.id, managerName);
      setAdjustments((p) =>
        p.map((a) =>
          a.id === modalAdj.id
            ? {
                ...a,
                status: "approved",
                approved_by: managerName,
                approved_at: new Date().toISOString(),
              }
            : a,
        ),
      );
      closeModal();
      toast.success("Adjustment Approved", {
        description: `Approved by ${managerName} — stock updated`,
      });
    } catch (e: any) {
      toast.error("Approval Failed", {
        description: e.message,
      });
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    if (!modalAdj || !managerName.trim() || !rejectNote.trim())
      return;
    setSubmitting(true);
    try {
      await rejectAdjustment(
        modalAdj.id,
        managerName,
        rejectNote,
      );
      setAdjustments((p) =>
        p.map((a) =>
          a.id === modalAdj.id
            ? {
                ...a,
                status: "rejected",
                approved_by: managerName,
                rejection_note: rejectNote,
              }
            : a,
        ),
      );
      closeModal();
      toast.success("Adjustment Rejected");
    } catch (e: any) {
      toast.error("Rejection Failed", {
        description: e.message,
      });
    }
    setSubmitting(false);
  };

  const closeModal = () => {
    setModalAdj(null);
    setManagerName("");
    setRejectNote("");
    setModalAction(null);
  };

  const newQty =
    form.product_id && form.qty_change !== ""
      ? form.qty_before +
        parseInt((form.qty_change as any) || "0")
      : null;

  const formValid =
    form.product_id &&
    form.qty_change &&
    parseInt(form.qty_change as any) !== 0 &&
    form.reason.length >= 10 &&
    form.requested_by.trim();

  const pendingAdjustments = adjustments.filter(
    (a) => a.status === "pending",
  );
  const historyAdjustments = adjustments.filter(
    (a) => a.status !== "pending",
  );
  const pendingCount = pendingAdjustments.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-[#F97316] text-white";
      case "approved":
        return "bg-[#00A3AD] text-white";
      case "rejected":
        return "bg-[#DC2626] text-white";
      default:
        return "bg-[#D1D5DB] text-[#111827]";
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      {/* Approval Modal */}
      <Dialog
        open={!!modalAdj}
        onOpenChange={() => closeModal()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1A2B47] text-xl font-semibold">
              Manager Approval Required
            </DialogTitle>
            <DialogDescription className="text-[#6B7280]">
              Review and approve/reject this stock adjustment
            </DialogDescription>
          </DialogHeader>

          {modalAdj && (
            <div className="space-y-4">
              {/* Summary Box */}
              <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-[#1A2B47]">
                      {modalAdj.product_name}
                    </div>
                    <div className="text-sm text-[#6B7280] font-mono mt-1">
                      SKU: {modalAdj.sku}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(modalAdj.status)}`}
                  >
                    {modalAdj.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#6B7280] mb-1">
                      Stock Change
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-[#1A2B47]">
                        {modalAdj.qty_before}
                      </span>
                      <span className="text-[#9CA3AF]">→</span>
                      <span
                        className={`text-lg font-bold ${
                          modalAdj.qty_change > 0
                            ? "text-[#00A3AD]"
                            : "text-[#F97316]"
                        }`}
                      >
                        {modalAdj.qty_after}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          modalAdj.qty_change > 0
                            ? "bg-[#00A3AD]/10 text-[#00A3AD]"
                            : "bg-[#F97316]/10 text-[#F97316]"
                        }`}
                      >
                        {modalAdj.qty_change > 0 ? "+" : ""}
                        {modalAdj.qty_change}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[#6B7280] mb-1">
                      Category
                    </div>
                    <div className="text-sm font-medium text-[#1A2B47] bg-white px-3 py-1 rounded border border-[#E5E7EB] inline-block">
                      {modalAdj.reason_category}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#6B7280] mb-1">
                    Reason
                  </div>
                  <div className="text-sm text-[#1A2B47] italic">
                    "{modalAdj.reason}"
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-[#6B7280] mb-1">
                      Requested By
                    </div>
                    <div className="text-sm font-medium text-[#1A2B47]">
                      {modalAdj.requested_by}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#6B7280] mb-1">
                      Requested At
                    </div>
                    <div className="text-sm text-[#6B7280]">
                      {new Date(
                        modalAdj.created_at,
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Manager Name Input */}
              <div className="space-y-2">
                <Label className="text-[#1A2B47] font-medium">
                  Manager Name{" "}
                  <span className="text-[#F97316]">*</span>
                </Label>
                <Input
                  placeholder="Enter your full name to authenticate"
                  value={managerName}
                  onChange={(e) =>
                    setManagerName(e.target.value)
                  }
                  className="border-[#1A2B47]/20"
                />
              </div>

              {/* Rejection Note */}
              {modalAction === "reject" && (
                <div className="space-y-2">
                  <Label className="text-[#1A2B47] font-medium">
                    Rejection Reason{" "}
                    <span className="text-[#F97316]">*</span>
                  </Label>
                  <Textarea
                    placeholder="Explain why this adjustment is being rejected…"
                    value={rejectNote}
                    onChange={(e) =>
                      setRejectNote(e.target.value)
                    }
                    rows={3}
                    className="border-[#1A2B47]/20"
                  />
                </div>
              )}

              {/* Action Buttons */}
              {!modalAction && (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                    onClick={() => setModalAction("approve")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve Adjustment
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/5"
                    onClick={() => setModalAction("reject")}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
              {modalAction === "approve" && (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                    disabled={!managerName.trim() || submitting}
                    onClick={handleApprove}
                  >
                    {submitting
                      ? "Approving…"
                      : `✓ Confirm as ${managerName || "…"}`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setModalAction(null)}
                    className="border-[#1A2B47]/20"
                  >
                    Back
                  </Button>
                </div>
              )}
              {modalAction === "reject" && (
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                    disabled={
                      !managerName.trim() ||
                      !rejectNote.trim() ||
                      submitting
                    }
                    onClick={handleReject}
                  >
                    {submitting
                      ? "Rejecting…"
                      : "Confirm Rejection"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setModalAction(null)}
                    className="border-[#1A2B47]/20"
                  >
                    Back
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
          Stock Management & Alerts
        </h1>
        <p className="text-[#6B7280]">
          Real-time inventory levels and manual stock
          adjustments
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={mainTab}
        onValueChange={setMainTab}
        className="space-y-6"
      >
        <TabsList className="bg-[#1A2B47] p-1 h-auto">
          <TabsTrigger
            value="inventory"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium"
          >
            <Package className="w-4 h-4 mr-2" />
            Inventory Overview
          </TabsTrigger>
          <TabsTrigger
            value="adjustments"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium relative"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Manual Adjustments
            {pendingCount > 0 && (
              <span className="ml-2 bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="movements"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium"
          >
            <FileBarChart className="w-4 h-4 mr-2" />
            Movement Report
          </TabsTrigger>
          <TabsTrigger
            value="valuation"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium"
          >
            <FileBarChart className="w-4 h-4 mr-2" />
            Valuation Report
          </TabsTrigger>
        </TabsList>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-[#111827]/10 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#00A3AD]/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-[#00A3AD]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#111827]">
                      {mockStock.length}
                    </div>
                    <div className="text-sm text-[#6B7280]">
                      Total SKUs Tracked
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#F97316]/20 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-[#F97316]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#F97316]">
                      {lowStockItems.length}
                    </div>
                    <div className="text-sm text-[#6B7280]">
                      Low Stock Alerts
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-[#DC2626]/20 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#DC2626]/10 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#DC2626]">
                      {criticalItems.length}
                    </div>
                    <div className="text-sm text-[#6B7280]">
                      Critical - Restock Now
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-[#F97316]/30 shadow-lg">
            <CardHeader className="bg-[#F97316]/5">
              <CardTitle className="text-[#111827] font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#F97316]" />
                Low Stock Alerts - Immediate Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 ${
                      item.status === "critical"
                        ? "border-[#DC2626] bg-[#DC2626]/5"
                        : "border-[#F97316] bg-[#F97316]/5"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-[#111827] mb-1">
                          {item.name}
                        </div>
                        <div className="text-sm text-[#6B7280]">
                          SKU: {item.sku}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === "critical"
                            ? "bg-[#DC2626] text-white"
                            : "bg-[#F97316] text-white"
                        }`}
                      >
                        {getStatusIcon(item.status)}
                        {item.status === "critical"
                          ? "Restock Needed"
                          : "Low Stock"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-[#6B7280] mb-1">
                          Current Stock
                        </div>
                        <div
                          className={`text-lg font-bold ${
                            item.status === "critical"
                              ? "text-[#DC2626]"
                              : "text-[#F97316]"
                          }`}
                        >
                          {item.currentStock.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#6B7280] mb-1">
                          Min Stock Level
                        </div>
                        <div className="text-lg font-semibold text-[#111827]">
                          {item.minStock.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#6B7280] mb-1">
                          Shortage
                        </div>
                        <div className="text-lg font-bold text-[#F97316]">
                          -
                          {(
                            item.minStock - item.currentStock
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[#6B7280]">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        {item.location} • {item.zone} •{" "}
                        {item.aisle}
                      </div>
                      <Button
                        size="sm"
                        className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowTransferDialog(true);
                        }}
                      >
                        Create P.O.
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-[#6B7280] mb-2 block">
                    Search (SKU/Product)
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                    <Input
                      placeholder="Search by SKU or product name..."
                      value={searchTerm}
                      onChange={(e) =>
                        setSearchTerm(e.target.value)
                      }
                      className="pl-10 border-[#111827]/10"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[#6B7280] mb-2 block">
                    Warehouse Location
                  </Label>
                  <Select
                    value={locationFilter}
                    onValueChange={setLocationFilter}
                  >
                    <SelectTrigger className="border-[#111827]/10">
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All Locations
                      </SelectItem>
                      {warehouseLocations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[#6B7280] mb-2 block">
                    Stock Status
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                  >
                    <SelectTrigger className="border-[#111827]/10">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All Status
                      </SelectItem>
                      <SelectItem value="healthy">
                        Healthy
                      </SelectItem>
                      <SelectItem value="low">
                        Low Stock
                      </SelectItem>
                      <SelectItem value="critical">
                        Critical
                      </SelectItem>
                      <SelectItem value="overstock">
                        Overstock
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end md:col-span-4 lg:col-span-1">
                  <Dialog
                    open={showTransferDialog}
                    onOpenChange={setShowTransferDialog}
                  >
                    <DialogTrigger asChild>
                      <Button className="w-full bg-[#00A3AD] hover:bg-[#0891B2] text-white">
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Stock Transfer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-[#111827]">
                          Stock Transfer Request
                        </DialogTitle>
                        <DialogDescription className="text-[#6B7280]">
                          Transfer stock between warehouse
                          locations
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Product</Label>
                          <Select>
                            <SelectTrigger className="mt-2 border-[#111827]/10">
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {mockStock.map((item) => (
                                <SelectItem
                                  key={item.id}
                                  value={item.id}
                                >
                                  {item.name} ({item.sku})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>From Location</Label>
                          <Select>
                            <SelectTrigger className="mt-2 border-[#111827]/10">
                              <SelectValue placeholder="Select source..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouseLocations.map((loc) => (
                                <SelectItem
                                  key={loc}
                                  value={loc}
                                >
                                  {loc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>To Location</Label>
                          <Select>
                            <SelectTrigger className="mt-2 border-[#111827]/10">
                              <SelectValue placeholder="Select destination..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouseLocations.map((loc) => (
                                <SelectItem
                                  key={loc}
                                  value={loc}
                                >
                                  {loc}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-end">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setShowTransferDialog(false)
                          }
                          className="border-[#111827]/20 text-[#111827]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleStockTransfer}
                          className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
                        >
                          Initiate Transfer
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#111827] font-semibold">
                Stock Levels by Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#1A2B47]">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        SKU
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Product
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Location
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Zone/Aisle/Bin
                      </th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Current
                      </th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Min/Max
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Status
                      </th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-[#111827] bg-[#F8FAFC]">
                        Last Restocked
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="py-4 px-4">
                          <span className="font-mono text-[#00A3AD] font-semibold">
                            {item.sku}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-[#111827] font-medium">
                          {item.name}
                        </td>
                        <td className="py-4 px-4 text-sm text-[#6B7280]">
                          {item.location}
                        </td>
                        <td className="py-4 px-4 text-sm text-[#6B7280]">
                          {item.zone} • {item.aisle} •{" "}
                          {item.bin}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`font-bold ${
                              item.status === "critical" ||
                              item.status === "low"
                                ? "text-[#F97316]"
                                : "text-[#111827]"
                            }`}
                          >
                            {item.currentStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right text-sm text-[#6B7280]">
                          {item.minStock.toLocaleString()} /{" "}
                          {item.maxStock.toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}
                          >
                            {getStatusIcon(item.status)}
                            {item.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-[#6B7280]">
                          {item.lastRestocked}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MANUAL ADJUSTMENTS TAB */}
        <TabsContent value="adjustments" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#1A2B47]">
                Manual Stock Adjustment
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Adjustments are saved as Pending until a Manager
                approves
              </p>
            </div>
            {pendingCount > 0 && (
              <button
                onClick={() => setAdjustmentTab("pending")}
                className="bg-[#F97316]/10 border border-[#F97316] text-[#F97316] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#F97316]/20 transition-colors"
              >
                ⏳ {pendingCount} Pending Approval
                {pendingCount > 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Adjustment Sub-tabs */}
          <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-1 flex gap-1">
            {(["request", "pending", "history"] as const).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setAdjustmentTab(t)}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    adjustmentTab === t
                      ? "bg-white text-[#1A2B47] shadow-sm"
                      : "text-[#6B7280] hover:text-[#1A2B47]"
                  }`}
                >
                  {t === "request" && "+ New Adjustment"}
                  {t === "pending" && (
                    <span className="flex items-center justify-center gap-2">
                      Pending Approval
                      {pendingCount > 0 && (
                        <span className="bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {pendingCount}
                        </span>
                      )}
                    </span>
                  )}
                  {t === "history" && "History"}
                </button>
              ),
            )}
          </div>

          {/* REQUEST FORM */}
          {adjustmentTab === "request" && (
            <Card className="bg-white border-[#1A2B47]/10">
              <CardHeader className="bg-[#1A2B47]/5">
                <CardTitle className="text-[#1A2B47] text-sm font-semibold uppercase tracking-wide">
                  Adjustment Request
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Product Selection */}
                <div className="space-y-2">
                  <Label className="text-[#1A2B47] font-medium">
                    Product{" "}
                    <span className="text-[#F97316]">*</span>
                  </Label>
                  <Select
                    value={
                      form.product_id
                        ? String(form.product_id)
                        : ""
                    }
                    onValueChange={handleProductChange}
                  >
                    <SelectTrigger className="border-[#1A2B47]/20">
                      <SelectValue placeholder="Select a product…" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem
                          key={p.product_id}
                          value={String(p.product_id)}
                        >
                          {p.sku} — {p.product_name} (stock:{" "}
                          {p.inventory_on_hand})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock Preview */}
                {form.product_id > 0 && (
                  <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-4 flex items-center gap-6">
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">
                        Current Stock
                      </div>
                      <div className="text-2xl font-bold text-[#1A2B47] font-mono">
                        {form.qty_before}
                      </div>
                    </div>
                    <div className="text-2xl text-[#D1D5DB]">
                      →
                    </div>
                    <div>
                      <div className="text-xs text-[#6B7280] mb-1">
                        After Adjustment
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono ${
                          newQty === null
                            ? "text-[#9CA3AF]"
                            : newQty < 0
                              ? "text-[#DC2626]"
                              : newQty > form.qty_before
                                ? "text-[#00A3AD]"
                                : "text-[#F97316]"
                        }`}
                      >
                        {newQty ?? "—"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Qty Change & Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#1A2B47] font-medium">
                      Qty Change{" "}
                      <span className="text-[#F97316]">*</span>
                    </Label>
                    <Input
                      type="number"
                      placeholder="e.g. -5 or +10"
                      value={form.qty_change}
                      onChange={f("qty_change")}
                      className="border-[#1A2B47]/20"
                    />
                    <p className="text-xs text-[#6B7280]">
                      Negative = remove · Positive = add
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#1A2B47] font-medium">
                      Reason Category{" "}
                      <span className="text-[#F97316]">*</span>
                    </Label>
                    <Select
                      value={form.reason_category}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          reason_category: v as ReasonCategory,
                        }))
                      }
                    >
                      <SelectTrigger className="border-[#1A2B47]/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASON_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-[#1A2B47] font-medium">
                    Reason / Notes{" "}
                    <span className="text-[#F97316]">*</span>
                    <span className="text-xs text-[#6B7280] ml-2 font-normal">
                      (min 10 characters)
                    </span>
                  </Label>
                  <Textarea
                    placeholder="Describe why this stock adjustment is needed…"
                    value={form.reason}
                    onChange={f("reason")}
                    rows={3}
                    className="border-[#1A2B47]/20"
                  />
                  <p
                    className={`text-xs ${
                      form.reason.length >= 10
                        ? "text-[#00A3AD]"
                        : "text-[#9CA3AF]"
                    }`}
                  >
                    {form.reason.length} chars{" "}
                    {form.reason.length >= 10
                      ? "✓"
                      : "(need 10+)"}
                  </p>
                </div>

                {/* Requested By */}
                <div className="space-y-2">
                  <Label className="text-[#1A2B47] font-medium">
                    Requested By{" "}
                    <span className="text-[#F97316]">*</span>
                  </Label>
                  <Input
                    placeholder="Your full name"
                    value={form.requested_by}
                    onChange={f("requested_by")}
                    className="border-[#1A2B47]/20"
                  />
                </div>

                {/* Info + Submit */}
                <div className="flex items-start gap-4">
                  <div className="flex-1 bg-[#00A3AD]/10 border border-[#00A3AD]/20 rounded-lg p-4 text-sm text-[#1A2B47]">
                    ⓘ This will be logged as{" "}
                    <strong className="text-[#00A3AD]">
                      Manual Adjustment
                    </strong>{" "}
                    and saved as{" "}
                    <strong className="text-[#F97316]">
                      Pending
                    </strong>{" "}
                    until a Manager approves.
                  </div>
                  <Button
                    className="bg-[#00A3AD] hover:bg-[#0891B2] text-white disabled:opacity-50"
                    disabled={!formValid || submitting}
                    onClick={handleSubmitAdjustment}
                  >
                    {submitting
                      ? "Submitting…"
                      : "Submit for Approval"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PENDING APPROVALS */}
          {adjustmentTab === "pending" && (
            <Card className="bg-white border-[#1A2B47]/10">
              <CardHeader className="bg-[#F97316]/5">
                <CardTitle className="text-[#1A2B47] text-sm font-semibold uppercase tracking-wide">
                  Pending Manager Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <p className="text-center text-[#6B7280] py-12">
                    Loading…
                  </p>
                ) : pendingAdjustments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">✓</div>
                    <p className="text-[#6B7280]">
                      No pending adjustments
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingAdjustments.map((a) => (
                      <div
                        key={a.id}
                        className="bg-[#F8FAFC] border-l-4 border-[#F97316] border border-[#E5E7EB] rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-[#1A2B47]">
                              {a.product_name}
                            </div>
                            <div className="text-sm text-[#6B7280] font-mono mt-1">
                              {a.sku}
                            </div>
                          </div>
                          <span className="bg-[#F97316] text-white px-3 py-1 rounded-full text-xs font-medium">
                            Pending
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          <span className="text-[#6B7280]">
                            {a.qty_before} →{" "}
                            <strong>{a.qty_after}</strong>
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              a.qty_change > 0
                                ? "bg-[#00A3AD]/10 text-[#00A3AD]"
                                : "bg-[#F97316]/10 text-[#F97316]"
                            }`}
                          >
                            {a.qty_change > 0 ? "+" : ""}
                            {a.qty_change}
                          </span>
                          <span className="bg-white px-2 py-1 rounded text-xs border border-[#E5E7EB]">
                            {a.reason_category}
                          </span>
                          <span className="text-[#6B7280] text-xs">
                            by {a.requested_by}
                          </span>
                          <span className="text-[#6B7280] text-xs">
                            {new Date(
                              a.created_at,
                            ).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-[#6B7280] italic">
                          "{a.reason}"
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-[#00A3AD]/10 text-[#00A3AD] hover:bg-[#00A3AD]/20 border border-[#00A3AD]/20"
                            onClick={() => {
                              setModalAdj(a);
                              setModalAction("approve");
                            }}
                          >
                            ✓ Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/5"
                            onClick={() => {
                              setModalAdj(a);
                              setModalAction("reject");
                            }}
                          >
                            ✕ Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#E5E7EB] text-[#6B7280]"
                            onClick={() => {
                              setModalAdj(a);
                              setModalAction(null);
                            }}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* HISTORY */}
          {adjustmentTab === "history" && (
            <Card className="bg-white border-[#1A2B47]/10">
              <CardHeader className="bg-[#1A2B47]/5">
                <CardTitle className="text-[#1A2B47] text-sm font-semibold uppercase tracking-wide">
                  Adjustment History — logged as "Manual
                  Adjustment"
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <p className="text-center text-[#6B7280] py-12">
                    Loading…
                  </p>
                ) : historyAdjustments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="text-[#6B7280]">
                      No history yet
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b-2 border-[#1A2B47]">
                          {[
                            "Date",
                            "SKU",
                            "Product",
                            "Change",
                            "Before → After",
                            "Category",
                            "Requested By",
                            "Approved By",
                            "Status",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left py-3 px-3 text-xs font-semibold text-[#1A2B47] uppercase tracking-wide bg-[#F8FAFC]"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {historyAdjustments.map((a) => (
                          <tr
                            key={a.id}
                            className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                          >
                            <td className="py-3 px-3 text-sm text-[#6B7280]">
                              {new Date(
                                a.created_at,
                              ).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 font-mono text-sm text-[#00A3AD]">
                              {a.sku}
                            </td>
                            <td className="py-3 px-3 text-sm font-medium text-[#1A2B47]">
                              {a.product_name}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-bold ${
                                  a.qty_change > 0
                                    ? "bg-[#00A3AD]/10 text-[#00A3AD]"
                                    : "bg-[#F97316]/10 text-[#F97316]"
                                }`}
                              >
                                {a.qty_change > 0 ? "+" : ""}
                                {a.qty_change}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm font-mono text-[#6B7280]">
                              {a.qty_before} → {a.qty_after}
                            </td>
                            <td className="py-3 px-3">
                              <span className="bg-[#F8FAFC] border border-[#E5E7EB] px-2 py-1 rounded text-xs">
                                {a.reason_category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-[#6B7280]">
                              {a.requested_by}
                            </td>
                            <td className="py-3 px-3 text-sm text-[#6B7280]">
                              {a.approved_by ?? (
                                <span className="text-[#D1D5DB]">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(a.status)}`}
                              >
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MOVEMENT & VALUATION TAB */}
        <TabsContent value="movements" className="space-y-6">
          <MovementReport />
        </TabsContent>

        {/* VALUATION REPORT TAB */}
        <TabsContent value="valuation" className="space-y-6">
          <ValuationReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
