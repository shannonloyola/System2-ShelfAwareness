import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  Search,
  XCircle,
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
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase } from "@/lib/supabase";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ShipmentDiscrepancy = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  shipment_id?: string | null;
  shipment_reference?: string | null;
  po_number?: string | null;
  sku?: string | null;
  product_name?: string | null;
  expected_qty?: number | null;
  received_qty?: number | null;
  discrepancy_reason?: string | null;
  notes?: string | null;
  reported_by?: string | null;
  image_urls?: string[] | string | null;
  disposition?: "released" | "returned" | "scrapped" | null;
  [key: string]: unknown;
};

type QcInspectionRow = Record<string, unknown>;

const normalizeStatus = (rawStatus: string | null | undefined) => {
  const s = (rawStatus ?? "").trim().toLowerCase();
  if (!s) return "pending";
  return s;
};

const formatMaybeNumber = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString();
};

const extractImageUrls = (
  row: ShipmentDiscrepancy | null,
): string[] => {
  if (!row) return [];
  const raw = row.image_urls ?? row["image_url"] ?? row["images"];
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item) => typeof item === "string" && item.trim(),
          );
        }
      } catch {
        // fall through to split handling
      }
    }
    return trimmed
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

export function DiscrepancyApprovals() {
  const [discrepancies, setDiscrepancies] = useState<
    ShipmentDiscrepancy[]
  >([]);
  const [qcSummary, setQcSummary] = useState({
    pass: 0,
    fail: 0,
  });
  const [supplierDefects, setSupplierDefects] = useState<
    Array<{ name: string; defects: number }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReportsLoading, setIsReportsLoading] =
    useState(false);
  const [statusFilter, setStatusFilter] =
    useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDetail, setSelectedDetail] =
    useState<ShipmentDiscrepancy | null>(null);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(
    null,
  );
  const [reportsOpen, setReportsOpen] = useState(true);

  const fetchDiscrepancies = async () => {
    setIsLoading(true);
    try {
      const url =
        `https://${projectId}.supabase.co/rest/v1/shipment_discrepancies` +
        `?select=*` +
        `&status=neq.approved` +
        `&order=created_at.desc`;

      const res = await fetch(url, {
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${publicAnonKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) throw new Error(await res.text());

      const data = (await res.json()) as ShipmentDiscrepancy[];
      setDiscrepancies(data);
      if (!selectedDetail && data.length > 0) {
        setSelectedDetail(data[0]);
      }
    } catch (err) {
      toast.error("Failed to load discrepancies", {
        description:
          err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyLocalUpdate = (
    id: string,
    patch: Partial<ShipmentDiscrepancy>,
  ) => {
    setDiscrepancies((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    setSelectedDetail((prev) =>
      prev && prev.id === id ? { ...prev, ...patch } : prev,
    );
  };

  const updateDisposition = async (
    row: ShipmentDiscrepancy,
    action: "released" | "returned" | "scrapped",
  ) => {
    if (!row?.id) return;
    setIsUpdatingId(row.id);
    try {
      const payload = {
        disposition: action,
      };

      const res = await fetch(
        `https://${projectId}.supabase.co/rest/v1/shipment_discrepancies?id=eq.${row.id}`,
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

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      applyLocalUpdate(row.id, payload);
      toast.success("Disposition updated", {
        description: `Marked as ${action}.`,
      });
    } catch (err) {
      toast.error("Failed to update disposition", {
        description:
          err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const loadReports = async () => {
    setIsReportsLoading(true);
    try {
      const [qcRes, discrepanciesRes] = await Promise.all([
        supabase.from("qc_inspections").select("*"),
        supabase.from("shipment_discrepancies").select("*"),
      ]);

      if (qcRes.error) throw qcRes.error;
      if (discrepanciesRes.error) throw discrepanciesRes.error;

      const qcRows = (qcRes.data ?? []) as QcInspectionRow[];
      const qcTotals = { pass: 0, fail: 0 };

      qcRows.forEach((row) => {
        const raw =
          (row.result ??
            row.status ??
            row.outcome ??
            row.qc_status ??
            row.decision ??
            "") as string;
        const value = String(raw).toLowerCase();
        if (value.includes("pass")) qcTotals.pass += 1;
        if (value.includes("fail") || value.includes("reject")) {
          qcTotals.fail += 1;
        }
      });

      const discrepancyRows =
        (discrepanciesRes.data ?? []) as ShipmentDiscrepancy[];
      const supplierMap = new Map<string, number>();

      discrepancyRows.forEach((row) => {
        const name =
          (row["supplier_name"] as string | undefined) ??
          (row["vendor_name"] as string | undefined) ??
          (row["supplier"] as string | undefined) ??
          (row["vendor"] as string | undefined) ??
          row.reported_by ??
          "Unknown Supplier";
        const key = name || "Unknown Supplier";
        supplierMap.set(key, (supplierMap.get(key) ?? 0) + 1);
      });

      const supplierData = Array.from(supplierMap.entries())
        .map(([name, defects]) => ({ name, defects }))
        .sort((a, b) => b.defects - a.defects)
        .slice(0, 6);

      setQcSummary(qcTotals);
      setSupplierDefects(supplierData);
    } catch (err) {
      toast.error("Failed to load quality reports", {
        description:
          err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscrepancies();
    loadReports();
  }, []);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    discrepancies.forEach((row) => {
      unique.add(normalizeStatus(row.status));
    });
    return ["all", ...Array.from(unique).sort()];
  }, [discrepancies]);

  const filteredDiscrepancies = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return discrepancies.filter((row) => {
      if (
        statusFilter !== "all" &&
        normalizeStatus(row.status) !== statusFilter
      ) {
        return false;
      }
      if (!keyword) return true;
      const haystack = [
        row.id,
        row.shipment_reference,
        row.shipment_id,
        row.po_number,
        row.sku,
        row.product_name,
        row.reported_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [discrepancies, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    discrepancies.forEach((row) => {
      const status = normalizeStatus(row.status);
      counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
  }, [discrepancies]);

  const selectedImages = useMemo(
    () => extractImageUrls(selectedDetail),
    [selectedDetail],
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-[#F97316] text-white";
      case "rejected":
        return "bg-[#DC2626] text-white";
      case "in_review":
        return "bg-[#2563EB] text-white";
      case "resolved":
        return "bg-[#10B981] text-white";
      case "released":
        return "bg-[#10B981] text-white";
      case "returned":
        return "bg-[#F59E0B] text-white";
      case "scrapped":
        return "bg-[#DC2626] text-white";
      default:
        return "bg-[#E5E7EB] text-[#111827]";
    }
  };

  const qcChartData = useMemo(
    () => [
      { name: "Pass", count: qcSummary.pass },
      { name: "Fail", count: qcSummary.fail },
    ],
    [qcSummary],
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 bg-[#F8FAFC]">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-semibold mb-2 text-[#111827]">
            Discrepancies Dashboard
          </h1>
          <p className="text-[#6B7280]">
            Monitor inbound shipment issues awaiting approval
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search shipment, SKU, product"
              className="pl-9 w-64 border-[#111827]/10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-[#111827]/10">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all"
                    ? "All Status"
                    : option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
            onClick={fetchDiscrepancies}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-[#111827] font-semibold">
              View Reports
            </CardTitle>
            <p className="text-sm text-[#6B7280]">
              Quality analytics for inbound shipments
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
              onClick={loadReports}
              disabled={isReportsLoading}
            >
              Refresh Reports
            </Button>
            <Button
              variant="outline"
              className="border-[#111827]/20 text-[#111827]"
              onClick={() => setReportsOpen((prev) => !prev)}
            >
              {reportsOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {reportsOpen && (
          <CardContent className="space-y-4">
            {isReportsLoading ? (
              <div className="text-center py-8 text-[#6B7280]">
                Loading analytics...
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <p className="text-sm font-semibold text-[#111827] mb-1">
                    Pass/Fail QC Ratio
                  </p>
                  <p className="text-xs text-[#6B7280] mb-4">
                    Inspection outcomes across inbound shipments
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={qcChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#00A3AD" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-[#E5E7EB] p-4">
                  <p className="text-sm font-semibold text-[#111827] mb-1">
                    Supplier Defect Volume
                  </p>
                  <p className="text-xs text-[#6B7280] mb-4">
                    Discrepancy counts by supplier
                  </p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={supplierDefects}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="defects" fill="#F97316" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#F97316]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {statusCounts.pending ?? 0}
                </div>
                <div className="text-sm text-[#6B7280]">
                  Pending
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#2563EB]/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#2563EB]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#111827]">
                  {statusCounts.in_review ?? 0}
                </div>
                <div className="text-sm text-[#6B7280]">
                  In Review
                </div>
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
                  {statusCounts.rejected ?? 0}
                </div>
                <div className="text-sm text-[#6B7280]">
                  Rejected
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold">
              Discrepancy Queue ({filteredDiscrepancies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-[#6B7280]">
                  Loading discrepancies...
                </p>
              </div>
            ) : filteredDiscrepancies.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-[#D1D5DB] mb-4" />
                <p className="text-[#6B7280] font-medium">
                  No discrepancies found
                </p>
                <p className="text-sm text-[#9CA3AF] mt-2">
                  Everything is currently approved or resolved
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Discrepancy ID
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Shipment / PO
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Item
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-[#111827]">
                        Expected
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-[#111827]">
                        Received
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-[#111827]">
                        Variance
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Reported
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-[#111827]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiscrepancies.map((row) => {
                      const expectedQty = Number(row.expected_qty);
                      const receivedQty = Number(row.received_qty);
                      const variance =
                        Number.isFinite(expectedQty) &&
                        Number.isFinite(receivedQty)
                          ? receivedQty - expectedQty
                          : null;
                      const status = normalizeStatus(row.status);

                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[#E5E7EB] last:border-b-0 hover:bg-[#F8FAFC]/60"
                        >
                          <td className="py-3 px-4 font-mono text-[#00A3AD]">
                            {row.id?.slice(0, 8) || "-"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[#111827] font-medium">
                              {row.shipment_reference ||
                                row.shipment_id ||
                                row.po_number ||
                                "-"}
                            </div>
                            {row.po_number && (
                              <div className="text-xs text-[#6B7280]">
                                PO: {row.po_number}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-[#111827] font-medium">
                              {row.product_name || "-"}
                            </div>
                            <div className="text-xs text-[#6B7280]">
                              SKU: {row.sku || "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-[#111827]">
                            {formatMaybeNumber(row.expected_qty)}
                          </td>
                          <td className="py-3 px-4 text-right text-[#111827]">
                            {formatMaybeNumber(row.received_qty)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {variance === null ? (
                              <span className="text-[#9CA3AF]">-</span>
                            ) : (
                              <span
                                className={
                                  variance < 0
                                    ? "text-[#F97316] font-semibold"
                                    : variance > 0
                                      ? "text-[#00A3AD] font-semibold"
                                      : "text-[#111827]"
                                }
                              >
                                {variance > 0 ? "+" : ""}
                                {variance.toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={[
                                "inline-flex items-center justify-center",
                                "px-2.5 py-1",
                                "rounded-full",
                                "text-[11px] font-semibold leading-none",
                                "uppercase tracking-wide",
                                getStatusStyle(status),
                              ].join(" ")}
                            >
                              {status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#6B7280]">
                            <div>{row.reported_by || "-"}</div>
                            <div className="text-xs">
                              {row.created_at
                                ? new Date(row.created_at).toLocaleString()
                                : "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#111827]/20 text-[#111827]"
                              onClick={() => setSelectedDetail(row)}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#111827] font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00A3AD]" />
              Detail Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDetail ? (
              <div className="text-center py-8 text-[#9CA3AF]">
                Select a discrepancy to view details.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-md border border-[#E5E7EB] p-3">
                    <p className="text-xs text-[#6B7280]">
                      Discrepancy ID
                    </p>
                    <p className="font-semibold text-[#111827]">
                      {selectedDetail.id}
                    </p>
                  </div>
                  <div className="rounded-md border border-[#E5E7EB] p-3">
                    <p className="text-xs text-[#6B7280]">Status</p>
                    <p className="font-semibold text-[#111827] capitalize">
                      {normalizeStatus(selectedDetail.status).replace(
                        /_/g,
                        " ",
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-[#E5E7EB] p-3">
                    <p className="text-xs text-[#6B7280]">
                      Disposition
                    </p>
                    <p className="font-semibold text-[#111827] capitalize">
                      {selectedDetail.disposition
                        ? selectedDetail.disposition.replace(
                            /_/g,
                            " ",
                          )
                        : "Unassigned"}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-1">
                  <p className="text-xs text-[#6B7280]">Shipment</p>
                  <p className="font-semibold text-[#111827]">
                    {selectedDetail.shipment_reference ||
                      selectedDetail.shipment_id ||
                      "-"}
                  </p>
                  {selectedDetail.po_number && (
                    <p className="text-xs text-[#6B7280]">
                      PO: {selectedDetail.po_number}
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-1">
                  <p className="text-xs text-[#6B7280]">Item</p>
                  <p className="font-semibold text-[#111827]">
                    {selectedDetail.product_name || "-"}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    SKU: {selectedDetail.sku || "-"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <div>
                    <p className="text-xs text-[#6B7280]">Expected</p>
                    <p className="text-lg font-semibold text-[#111827]">
                      {formatMaybeNumber(selectedDetail.expected_qty)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">Received</p>
                    <p className="text-lg font-semibold text-[#111827]">
                      {formatMaybeNumber(selectedDetail.received_qty)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">Variance</p>
                    <p className="text-lg font-semibold text-[#111827]">
                      {(() => {
                        const expected = Number(selectedDetail.expected_qty);
                        const received = Number(selectedDetail.received_qty);
                        if (!Number.isFinite(expected) || !Number.isFinite(received)) {
                          return "-";
                        }
                        const variance = received - expected;
                        return `${variance > 0 ? "+" : ""}${variance.toLocaleString()}`;
                      })()}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-2">
                  <p className="text-xs text-[#6B7280]">Reason</p>
                  <p className="text-sm text-[#111827]">
                    {selectedDetail.discrepancy_reason || "No reason provided"}
                  </p>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-2">
                  <p className="text-xs text-[#6B7280]">Notes</p>
                  <p className="text-sm text-[#111827]">
                    {selectedDetail.notes || "No notes"}
                  </p>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-2">
                  <p className="text-xs text-[#6B7280]">Reported By</p>
                  <p className="text-sm text-[#111827]">
                    {selectedDetail.reported_by || "-"}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {selectedDetail.created_at
                      ? new Date(selectedDetail.created_at).toLocaleString()
                      : "-"}
                  </p>
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-2">
                  <p className="text-xs text-[#6B7280]">Image URLs</p>
                  {selectedImages.length === 0 ? (
                    <p className="text-sm text-[#9CA3AF]">
                      No images attached
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedImages.map((url, idx) => (
                        <a
                          key={`${url}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-[#2563EB] underline break-all"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-[#E5E7EB] p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#6B7280]">
                        Quarantined Stock
                      </p>
                      <p className="text-sm text-[#111827]">
                        Variance placed on hold for disposition
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#6B7280]">
                        Quarantined Qty
                      </p>
                      <p className="text-lg font-semibold text-[#111827]">
                        {(() => {
                          const expected = Number(
                            selectedDetail.expected_qty,
                          );
                          const received = Number(
                            selectedDetail.received_qty,
                          );
                          if (
                            !Number.isFinite(expected) ||
                            !Number.isFinite(received)
                          ) {
                            return "-";
                          }
                          return Math.abs(
                            received - expected,
                          ).toLocaleString();
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      className="bg-[#10B981] hover:bg-[#059669] text-white"
                      onClick={() =>
                        updateDisposition(selectedDetail, "released")
                      }
                      disabled={isUpdatingId === selectedDetail.id}
                    >
                      Release
                    </Button>
                    <Button
                      className="bg-[#F59E0B] hover:bg-[#D97706] text-white"
                      onClick={() =>
                        updateDisposition(selectedDetail, "returned")
                      }
                      disabled={isUpdatingId === selectedDetail.id}
                    >
                      Return
                    </Button>
                    <Button
                      className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                      onClick={() =>
                        updateDisposition(selectedDetail, "scrapped")
                      }
                      disabled={isUpdatingId === selectedDetail.id}
                    >
                      Scrap
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
