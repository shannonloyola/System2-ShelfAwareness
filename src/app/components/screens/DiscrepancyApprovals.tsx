import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Eye,
  FileText,
  Package
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface Discrepancy {
  id: string;
  poNumber: string;
  productName: string;
  sku: string;
  expectedQty: number;
  receivedQty: number;
  status: "pending" | "approved" | "rejected";
  reportedBy: string;
  dateReported: string;
  notes: string;
}

type GrnDraftLine = {
  id: string;
  grn_draft_id: string;
  line_no: number;
  product_id: string;
  product_name: string;
  sku: string;
  qty_expected: number;
  qty_received: number;
  discrepancy_reason: string | null;
  variance?: number; // if you already store it
};

type GrnDraft = {
  id: string;
  grn_number: string;
  received_date: string;
  notes: string | null;
  status: string;
  review_status: string | null;
  created_by: string | null;
  has_discrepancy: boolean;
  grn_draft_lines: GrnDraftLine[];
};

const mockDiscrepancies: Discrepancy[] = [
  {
    id: "1",
    poNumber: "PO-2026-002",
    productName: "Amoxicillin 500mg",
    sku: "AMX-500",
    expectedQty: 10000,
    receivedQty: 9850,
    status: "pending",
    reportedBy: "Maria Santos",
    dateReported: "2026-02-24",
    notes: "Short delivery - 3 boxes missing"
  },
  {
    id: "2",
    poNumber: "PO-2026-003",
    productName: "Medical Syringe 50ml",
    sku: "SYR-50ML",
    expectedQty: 5000,
    receivedQty: 5200,
    status: "pending",
    reportedBy: "Juan Reyes",
    dateReported: "2026-02-23",
    notes: "Over delivery - extra box included"
  }
];

export function DiscrepancyApprovals() {
  const [grns, setGrns] = useState<GrnDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchDiscrepancies = async () => {
    setIsLoading(true);
    try {
      const statusQuery =
        statusFilter === "all" ? "" : `&status=eq.${encodeURIComponent(statusFilter)}`;

      const url =
        `https://${projectId}.supabase.co/rest/v1/grn_drafts` +
        `?select=id,grn_number,received_date,notes,status, review_status, created_by,has_discrepancy,` +
        `grn_draft_lines(id,grn_draft_id,line_no,product_id,product_name,sku,qty_expected,qty_received,discrepancy_reason,variance)` +
        `&has_discrepancy=eq.true` +
        statusQuery +
        `&order=received_date.desc`;

      const res = await fetch(url, {
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as GrnDraft[];
      setGrns(data);
      console.log("Fetched GRN statuses sample:", data.slice(0, 5).map(g => ({ id: g.id, status: g.status })));
    } catch (err) {
      toast.error("Failed to load discrepancies", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscrepancies();
  }, [statusFilter]);

  const normalizeStatus = (rawStatus: string | null | undefined) => {
  const s = (rawStatus ?? "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  return "pending";
};

  const discrepancyCards = grns
  .filter(grn => normalizeStatus(grn.status) === "pending")
  .flatMap(grn =>
    (grn.grn_draft_lines || [])
      .filter(l => Number(l.qty_expected) !== Number(l.qty_received))
      .map(line => ({ grn, line }))
  );
const updateGrnStatus = async (grnId: string, action: "approve" | "reject") => {
  try {
    console.log("Updating GRN ID:", grnId, "action:", action);

    // update variances (keep your existing loop)
    const grnToUpdate = grns.find(g => g.id === grnId);
    if (grnToUpdate?.grn_draft_lines?.length) {
      for (const line of grnToUpdate.grn_draft_lines) {
        const calculatedVariance = Number(line.qty_received) - Number(line.qty_expected);

        const lineRes = await fetch(
          `https://${projectId}.supabase.co/rest/v1/grn_draft_lines?id=eq.${line.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: publicAnonKey,
              Authorization: `Bearer ${publicAnonKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ variance: calculatedVariance }),
          },
        );

        if (!lineRes.ok) {
          console.error("Failed to update line variance:", await lineRes.text());
        }
      }
    }

    // APPROVE => posted
    // REJECT => keep draft, but remove from discrepancy queue
    const payload =
  action === "approve"
    ? { status: "posted", review_status: "approved" }
    : { status: "draft", review_status: "rejected", has_discrepancy: false };

    const res = await fetch(
      `https://${projectId}.supabase.co/rest/v1/grn_drafts?id=eq.${grnId}`,
      {
        method: "PATCH",
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      },
    );

    console.log("PATCH response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("PATCH FAILED:", errorText);
      throw new Error(errorText);
    }

    toast.success(action === "approve" ? "Marked as approved" : "Marked as rejected", {
      description: "Variance has been saved to the database",
    });

    fetchDiscrepancies();
  } catch (err) {
    toast.error("Update failed", {
      description: err instanceof Error ? err.message : "Unknown error",
    });
  }
};
  
  const pendingCount = grns.filter(g => normalizeStatus(g.review_status) === "pending").length;
  const approvedCount = grns.filter(g => normalizeStatus(g.review_status) === "approved").length;
  const rejectedCount = grns.filter(g => normalizeStatus(g.review_status) === "rejected").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-[#F97316] text-white";
      case "approved": return "bg-[#00A3AD] text-white";
      case "rejected": return "bg-[#DC2626] text-white";
      default: return "bg-[#D1D5DB] text-[#111827]";
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance < 0) return "text-[#F97316]";
    if (variance > 0) return "text-[#00A3AD]";
    return "text-[#111827]";
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Discrepancy Approvals
          </h1>
          <p className="text-[#6B7280]">Review and approve inventory discrepancies</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-[#111827]/10">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#F97316]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {pendingCount}
                </div>
                <div className="text-sm text-[#6B7280]">Pending Review</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#00A3AD]/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-[#00A3AD]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {approvedCount}
                </div>
                <div className="text-sm text-[#6B7280]">Approved</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#DC2626]/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-[#DC2626]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {rejectedCount}
                </div>
                <div className="text-sm text-[#6B7280]">Rejected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies List */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold">
            Discrepancy Reports ({discrepancyCards.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-[#6B7280]">Loading discrepancies...</p>
              </div>
            ) : discrepancyCards.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[#6B7280] font-medium">No discrepancies found</p>
                <p className="text-sm text-[#9CA3AF] mt-2">All inventory receipts match expected quantities</p>
              </div>
            ) : (
              discrepancyCards.map(({ grn, line }) => {
                // ✅ VARIANCE CALCULATION: Physical Count - Database Stock
                // Formula: qty_received (Physical) - qty_expected (Database)
                // Positive variance = Overage, Negative variance = Shortage
                const variance = line.qty_received - line.qty_expected;
                
                const uiStatus = normalizeStatus(grn.status);
                const canTakeAction = uiStatus === "pending";

                return (
                  <Card key={line.id} className="border-[#111827]/10">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Main Info */}
                        <div className="lg:col-span-7 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-[#00A3AD] font-semibold">
                                  {grn.grn_number}
                                </span>
                                <span
                                className={[
                                  "inline-flex items-center justify-center",
                                  "px-2.5 py-1",
                                  "rounded-full",
                                  "text-[11px] font-semibold leading-none",
                                  "uppercase tracking-wide",
                                  getStatusColor(uiStatus),
                                ].join(" ")}
                              >
                                {uiStatus}
                              </span>
                              </div>
                              <h3 className="text-lg font-semibold text-[#111827]">
                                {line.product_name}
                              </h3>
                              <p className="text-sm text-[#6B7280]">SKU: {line.sku}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 p-3 bg-[#F8FAFC] rounded-lg">
                            <div>
                              <Label className="text-xs text-[#6B7280]">Expected</Label>
                              <p className="text-lg font-bold text-[#111827]">
                                {line.qty_expected.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-[#6B7280]">Received</Label>
                              <p className="text-lg font-bold text-[#111827]">
                                {line.qty_received.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-[#6B7280]">Variance</Label>
                              <p className={`text-lg font-bold ${getVarianceColor(variance)}`}>
                                {variance > 0 ? "+" : ""}{variance.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-[#6B7280]">Reported by:</span>
                              <span className="text-[#111827] font-medium">{grn.created_by}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-[#6B7280]">Date:</span>
                              <span className="text-[#111827]">{grn.received_date}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-[#6B7280]">Notes:</span>
                              <p className="text-[#111827] mt-1">{grn.notes}</p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="lg:col-span-5 flex flex-col justify-center gap-3">
                          {canTakeAction ? (
                            <>
                              <Button
                                onClick={() => updateGrnStatus(grn.id, "posted")}
                                className="bg-[#00A3AD] hover:bg-[#0891B2] text-white w-full"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve Discrepancy
                              </Button>
                              <Button
                                onClick={() => updateGrnStatus(grn.id, "draft")}
                                variant="outline"
                                className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10 w-full"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject & Investigate
                              </Button>
                              <Button
                                variant="outline"
                                className="border-[#111827]/20 text-[#111827] w-full"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </Button>
                            </>
                          ) : (
                            <div className="text-center p-4 bg-[#F8FAFC] rounded-lg">
                              <p className="text-sm text-[#6B7280]">
                                This discrepancy has been {uiStatus}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}