import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ChevronLeft,
  Clock,
  Hash,
  Package,
  Plane,
  RefreshCw,
  Ship,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import { PerItemTracker } from "../PerItemTracker";

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
  items: POItem[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const normalizeStatus = (status: string) => status.trim().toLowerCase();

const toErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Unexpected error";
  const maybe = error as { status?: number; message?: string; code?: string };
  if (maybe.status === 401 || maybe.status === 403) return "No permission / check RLS";
  return maybe.message ?? maybe.code ?? "Unexpected error";
};

const getTrackerSteps = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "posted") {
    return [
      { label: "Order Received", completed: true, active: false },
      { label: "Packaging (Supplier)", completed: false, active: true },
      { label: "Handed to Freight", completed: false, active: false },
      { label: "Arrived at Customs (PH)", completed: false, active: false },
      { label: "Warehouse Ready", completed: false, active: false },
    ];
  }
  if (normalized === "in-transit") {
    return [
      { label: "Order Received", completed: true, active: false },
      { label: "Packaging (Supplier)", completed: true, active: false },
      { label: "Handed to Freight", completed: false, active: true },
      { label: "Arrived at Customs (PH)", completed: false, active: false },
      { label: "Warehouse Ready", completed: false, active: false },
    ];
  }
  if (normalized === "received") {
    return [
      { label: "Order Received", completed: true, active: false },
      { label: "Packaging (Supplier)", completed: true, active: false },
      { label: "Handed to Freight", completed: true, active: false },
      { label: "Arrived at Customs (PH)", completed: true, active: false },
      { label: "Warehouse Ready", completed: true, active: false },
    ];
  }
  return [
    { label: "Order Received", completed: true, active: true },
    { label: "Packaging (Supplier)", completed: false, active: false },
    { label: "Handed to Freight", completed: false, active: false },
    { label: "Arrived at Customs (PH)", completed: false, active: false },
    { label: "Warehouse Ready", completed: false, active: false },
  ];
};

export function PODetailPage() {
  const navigate = useNavigate();
  const { poId = "" } = useParams();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    const [{ data: poData, error: poError }, { data: itemData, error: itemError }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("po_id, po_no, supplier_name, status, created_at")
        .eq("po_id", poId)
        .maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("po_item_id, po_id, item_name, quantity")
        .eq("po_id", poId)
        .order("po_item_id", { ascending: true }),
    ]);
    setLoading(false);

    if (poError || !poData) {
      toast.error("Failed to load purchase order", { description: toErrorMessage(poError) });
      setPo(null);
      return;
    }
    if (itemError) toast.error("Failed to load line items", { description: toErrorMessage(itemError) });

    setPo({
      po_id: poData.po_id,
      po_no: poData.po_no ?? "N/A",
      supplier_name: poData.supplier_name ?? "N/A",
      status: poData.status ?? "Unknown",
      created_at: poData.created_at ?? new Date().toISOString(),
      items: (itemData ?? []).map((it) => ({
        po_item_id: it.po_item_id,
        item_name: it.item_name ?? "Unnamed item",
        quantity: it.quantity ?? 0,
      })),
    });
  }, [poId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading || !po) {
    return (
      <div className="p-4">
        <Card className="bg-white border-[#111827]/10 shadow-sm">
          <CardContent className="py-10 text-center text-[#6B7280]">
            {loading ? "Loading purchase order..." : "Purchase order not found."}
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
          <CardTitle className="text-xl text-[#111827] font-bold">{po.po_no}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Building2 className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">Supplier</p>
                <p className="text-sm font-semibold text-[#111827]">{po.supplier_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Hash className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">PO Number</p>
                <p className="text-sm font-semibold text-[#111827]">{po.po_no}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">Status</p>
                <p className="text-sm font-semibold text-[#111827]">{po.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
              <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
              <div>
                <p className="text-xs text-[#6B7280]">Created</p>
                <p className="text-sm font-semibold text-[#111827]">{formatDate(po.created_at)}</p>
              </div>
            </div>
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
              <div className="text-sm text-[#6B7280]">No line items yet.</div>
            ) : (
              po.items.map((item) => (
                <div key={item.po_item_id} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] p-3">
                  <div className="text-sm text-[#111827]">{item.item_name}</div>
                  <div className="text-sm font-semibold text-[#111827]">Qty: {item.quantity}</div>
                </div>
              ))
            )}
          </div>

        </CardContent>
      </Card>

      <Card className="bg-[#F8FAFC] border-[#E5E7EB]">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">Freight Monitor</CardTitle>
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
            <TabsContent value="air" className="text-sm text-[#6B7280]">
              PO {po.po_no} is currently {po.status}. Air freight timeline is placeholder data.
            </TabsContent>
            <TabsContent value="sea" className="text-sm text-[#6B7280]">
              PO {po.po_no} is currently {po.status}. Sea freight timeline is placeholder data.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-[#111827] text-base">Per-Order Item Status Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <PerItemTracker poNumber={po.po_no} steps={getTrackerSteps(po.status)} />
        </CardContent>
      </Card>

    </div>
  );
}

export function POList() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    const [{ data: poData, error: poError }, { data: itemData, error: itemError }] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select("po_id, po_no, supplier_name, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("purchase_order_items")
        .select("po_item_id, po_id, item_name, quantity"),
    ]);
    setLoading(false);

    if (poError) {
      toast.error("Failed to load purchase orders", { description: toErrorMessage(poError) });
      setPos([]);
      return;
    }
    if (itemError) toast.error("Failed to load line item counts", { description: toErrorMessage(itemError) });

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
        items: map.get(po.po_id) ?? [],
      })),
    );
  }, []);

  useEffect(() => {
    void fetchPOs();
  }, [fetchPOs]);

  const filtered = pos.filter(
    (po) =>
      !search ||
      po.po_no.toLowerCase().includes(search.toLowerCase()) ||
      po.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      po.status.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 space-y-4 bg-white">
      <div>
        <h1 className="text-2xl lg:text-4xl font-semibold mb-2 text-[#111827]">Purchase Orders</h1>
        <p className="text-sm lg:text-base text-[#6B7280]">View and track all purchase orders</p>
      </div>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-[#111827] font-semibold">
              PO List
              {!loading && (
                <span className="ml-2 text-sm font-normal text-[#6B7280]">
                  {filtered.length} order{filtered.length !== 1 ? "s" : ""}
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
                onClick={() => void fetchPOs()}
                disabled={loading}
                className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
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
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">PO No.</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">Supplier</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">Created Date</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#6B7280]">Items</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && pos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#6B7280]">Loading purchase orders...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#6B7280]">
                      {search ? "No purchase orders match your search." : "No purchase orders found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((po, i) => (
                    <tr
                      key={po.po_id}
                      onClick={() => navigate(`/po-list/${po.po_id}`)}
                      className={`border-b border-[#E5E7EB] cursor-pointer transition-colors hover:bg-[#F0FAFA] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[#111827] whitespace-nowrap">{po.po_no}</td>
                      <td className="px-4 py-3 text-[#111827]">{po.supplier_name}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{po.status}</td>
                      <td className="px-4 py-3 text-[#6B7280] whitespace-nowrap">{formatDate(po.created_at)}</td>
                      <td className="px-4 py-3 text-center text-[#6B7280]">{po.items.length}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-[#00A3AD] font-semibold hover:underline">View all →</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
