import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronLeft,
  Package,
  Clock,
  Hash,
  Building2,
  Play,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import {
  runExpirationCheck,
  fetchExpiringSoon,
  fetchExpiredPOs,
} from "../../../imports/expirationService";

interface PurchaseOrder {
  po_id: string;
  po_no: string;
  supplier_name: string;
  status: string;
  created_at: string;
  items: POItem[];
}

interface POItem {
  po_item_id: string;
  item_name: string;
  quantity: number;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  "Pending Supplier Confirmation": {
    bg: "bg-amber-100",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  Confirmed: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  Shipped: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    dot: "bg-purple-500",
  },
  Received: {
    bg: "bg-green-100",
    text: "text-green-800",
    dot: "bg-green-500",
  },
  Cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${style.dot}`}
      />
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// =============================================================================
// PO DETAIL VIEW
// =============================================================================
function PODetail({
  po,
  onBack,
}: {
  po: PurchaseOrder;
  onBack: () => void;
}) {
  return (
    <div className="p-4 space-y-4 bg-white">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#00A3AD] hover:text-[#0891B2] font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to PO List
      </button>

      {/* Header card */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-[#6B7280] font-medium uppercase tracking-wide mb-1">
                Purchase Order
              </p>
              <CardTitle className="text-xl text-[#111827] font-bold">
                {po.po_no}
              </CardTitle>
            </div>
            <StatusBadge status={po.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <p className="text-sm font-semibold text-[#111827] font-mono">
                  {po.po_no}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">
                  Created
                </p>
                <p className="text-sm font-semibold text-[#111827]">
                  {formatDate(po.created_at)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items card */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-[#00A3AD]" />
            Line Items
            <span className="text-sm font-normal text-[#6B7280]">
              ({po.items.length} item
              {po.items.length !== 1 ? "s" : ""})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {po.items.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280]">
              <Package className="w-10 h-10 mx-auto mb-3 text-[#E5E7EB]" />
              <p className="text-sm">
                No line items on this PO.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-[#E5E7EB] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">
                      #
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">
                      Item Name
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-[#6B7280]">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, i) => (
                    <tr
                      key={item.po_item_id}
                      className={`border-b border-[#E5E7EB] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}
                    >
                      <td className="px-4 py-3 text-[#6B7280] text-xs">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#111827]">
                        {item.item_name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#111827]">
                        {item.quantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// PO LIST VIEW
// =============================================================================
export function POList() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] =
    useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState("");

  // Expiration tracking states
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [expiredPOs, setExpiredPOs] = useState<any[]>([]);
  const [expirationLoading, setExpirationLoading] = useState(false);
  const [runningExpiration, setRunningExpiration] = useState(false);
  const [lastExpirationRun, setLastExpirationRun] = useState<Date | null>(null);
  const [releasedPOs, setReleasedPOs] = useState<any[]>([]);

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const headers = {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
      };

      const res = await fetch(
        `https://${projectId}.supabase.co/rest/v1/purchase_orders` +
          `?select=po_id,po_no,supplier_name,status,created_at,purchase_order_items(po_item_id,item_name,quantity)` +
          `&order=created_at.desc`,
        { headers },
      );
      if (!res.ok) throw new Error(await res.text());
      const data: any[] = await res.json();

      const mapped: PurchaseOrder[] = data.map((po) => ({
        po_id: po.po_id,
        po_no: po.po_no,
        supplier_name: po.supplier_name,
        status: po.status,
        created_at: po.created_at,
        items: po.purchase_order_items ?? [],
      }));

      setPos(mapped);
    } catch (err) {
      console.error("fetchPOs error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  // Expiration tracking functions
  const loadExpirationData = async () => {
    setExpirationLoading(true);
    try {
      const [soon, expired] = await Promise.all([
        fetchExpiringSoon(),
        fetchExpiredPOs(),
      ]);
      setExpiringSoon(soon);
      setExpiredPOs(expired);
    } catch (e: any) {
      toast.error("Failed to load expiration data", { description: e.message });
    }
    setExpirationLoading(false);
  };

  const handleExpirationRun = async () => {
    setRunningExpiration(true);
    try {
      const result = await runExpirationCheck();
      setReleasedPOs(result ?? []);
      setLastExpirationRun(new Date());
      await loadExpirationData();
      if (result?.length > 0) {
        toast.success("Expiration Check Complete", {
          description: `Released stock from ${result.length} expired PO(s)`,
        });
      } else {
        toast.success("Expiration Check Complete", {
          description: "No expired reservations found",
        });
      }
    } catch (e: any) {
      toast.error("Expiration Check Failed", { description: e.message });
    }
    setRunningExpiration(false);
  };

  const timeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
  };

  // Auto-run expiration check every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => handleExpirationRun(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // If a PO is selected, show detail view
  if (selected) {
    return (
      <PODetail
        po={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  const filtered = pos.filter(
    (po) =>
      !search ||
      po.po_no.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier_name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      po.status.toLowerCase().includes(search.toLowerCase()),
  );

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

      <Tabs
        defaultValue="po-list"
        className="space-y-4"
        onValueChange={(value) => {
          if (value === "expiration") {
            loadExpirationData();
          }
        }}
      >
        <TabsList className="bg-[#1A2B47] text-white">
          <TabsTrigger
            value="po-list"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium"
          >
            <Package className="w-4 h-4 mr-2" />
            PO List
          </TabsTrigger>
          <TabsTrigger
            value="expiration"
            className="data-[state=active]:bg-[#00A3AD] data-[state=active]:text-white text-white/80 font-medium relative"
          >
            <Clock className="w-4 h-4 mr-2" />
            Expiration Tracking
            {expiringSoon.length > 0 && (
              <span className="ml-2 bg-[#F97316] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {expiringSoon.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* PO LIST TAB */}
        <TabsContent value="po-list" className="space-y-4">
          <Card className="bg-white border-[#111827]/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-[#111827] font-semibold">
                  PO List
                  {!loading && (
                    <span className="ml-2 text-sm font-normal text-[#6B7280]">
                      {filtered.length} order
                      {filtered.length !== 1 ? "s" : ""}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPOs}
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
                        Created Date
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
                          colSpan={6}
                          className="text-center py-12 text-[#6B7280]"
                        >
                          Loading purchase orders...
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center py-12 text-[#6B7280]"
                        >
                          {search
                            ? "No purchase orders match your search."
                            : "No purchase orders found."}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((po, i) => (
                        <tr
                          key={po.po_id}
                          onClick={() => setSelected(po)}
                          className={`border-b border-[#E5E7EB] cursor-pointer transition-colors hover:bg-[#F0FAFA] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}
                        >
                          <td className="px-4 py-3 font-mono font-semibold text-[#111827] whitespace-nowrap">
                            {po.po_no}
                          </td>
                          <td className="px-4 py-3 text-[#111827]">
                            {po.supplier_name}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={po.status} />
                          </td>
                          <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">
                            {formatDate(po.created_at)}
                          </td>
                          <td className="px-4 py-3 text-center text-[#6B7280]">
                            {po.items.length}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-[#00A3AD] font-semibold hover:underline">
                              View all →
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPIRATION TRACKING TAB */}
        <TabsContent value="expiration" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold text-[#1A2B47]">
                PO Expiration Service
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Unreleased reservations free up automatically every 15 min via
                pg_cron
                {lastExpirationRun && (
                  <> · Last manual run: {lastExpirationRun.toLocaleTimeString()}</>
                )}
              </p>
            </div>
            <Button
              className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
              disabled={runningExpiration}
              onClick={handleExpirationRun}
            >
              {runningExpiration ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Check Now
                </>
              )}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#FEF9C3] border-[#F97316]/30">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold text-[#F97316] mb-2">
                    {expiringSoon.length}
                  </div>
                  <div className="text-sm font-semibold text-[#F97316]">
                    Expiring in 2hrs
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#FEE2E2] border-[#DC2626]/30">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold text-[#DC2626] mb-2">
                    {expiredPOs.length}
                  </div>
                  <div className="text-sm font-semibold text-[#DC2626]">
                    Already Expired
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#DCFCE7] border-[#00A3AD]/30">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold text-[#00A3AD] mb-2">
                    {releasedPOs.length}
                  </div>
                  <div className="text-sm font-semibold text-[#00A3AD]">
                    Released This Run
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Expiring Soon Card */}
          <Card className="bg-white border-[#1A2B47]/10">
            <CardHeader className="bg-[#F97316]/5">
              <CardTitle className="text-[#1A2B47] text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F97316]" />
                Expiring Soon (within 2 hours)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {expirationLoading ? (
                <p className="text-center text-[#6B7280] py-12">Loading…</p>
              ) : expiringSoon.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12">
                  No reservations expiring soon
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="border-b-2 border-[#1A2B47]">
                        {[
                          "PO Number",
                          "Supplier",
                          "Status",
                          "Reserved At",
                          "Expires At",
                          "Time Left",
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
                      {expiringSoon.map((po) => (
                        <tr
                          key={po.po_id}
                          className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-[#1A2B47]">
                            {po.po_no}
                          </td>
                          <td className="py-3 px-3 text-sm text-[#6B7280]">
                            {po.supplier_name}
                          </td>
                          <td className="py-3 px-3">
                            <span className="bg-[#FEF9C3] text-[#854D0E] px-3 py-1 rounded-full text-xs font-semibold">
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[#6B7280]">
                            {new Date(po.reserved_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[#6B7280]">
                            {new Date(po.expires_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[#F97316] font-semibold text-sm">
                              {timeRemaining(po.expires_at)}
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

          {/* Expired POs Card */}
          <Card className="bg-white border-[#1A2B47]/10">
            <CardHeader className="bg-[#DC2626]/5">
              <CardTitle className="text-[#1A2B47] text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                <XCircle className="w-4 h-4 text-[#DC2626]" />
                Expired — Stock Released
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {expirationLoading ? (
                <p className="text-center text-[#6B7280] py-12">Loading…</p>
              ) : expiredPOs.length === 0 ? (
                <p className="text-center text-[#6B7280] py-12">
                  No expired reservations
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b-2 border-[#1A2B47]">
                        {["PO Number", "Supplier", "Expired At", "Status"].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left py-3 px-3 text-xs font-semibold text-[#1A2B47] uppercase tracking-wide bg-[#F8FAFC]"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {expiredPOs.map((po) => (
                        <tr
                          key={po.po_id}
                          className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3 px-3 font-semibold text-[#1A2B47]">
                            {po.po_no}
                          </td>
                          <td className="py-3 px-3 text-sm text-[#6B7280]">
                            {po.supplier_name}
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-[#6B7280]">
                            {new Date(po.expires_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span className="bg-[#FEE2E2] text-[#991B1B] px-3 py-1 rounded-full text-xs font-semibold">
                              {po.status}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}