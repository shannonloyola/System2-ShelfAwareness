import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { projectId, publicAnonKey } from "@/utils/supabase/info";

interface InventoryRow {
  product_id: number;
  sku: string;
  product_name: string;
  unit: string;
  qty_on_hand: number;
  updated_at: string;
}

const MIN_STOCK_THRESHOLD = 500;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function InventoryTable() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` };

      // Fetch products with their inventory_on_hand via product_uuid join
      const res = await fetch(
        `https://${projectId}.supabase.co/rest/v1/products` +
        `?select=product_id,sku,product_name,unit,product_uuid,inventory_on_hand!inner(qty_on_hand,updated_at)` +
        `&order=product_name.asc`,
        { headers }
      );
      if (!res.ok) throw new Error(await res.text());
      const data: any[] = await res.json();

      const mapped: InventoryRow[] = data.map((p) => ({
        product_id: p.product_id,
        sku: p.sku,
        product_name: p.product_name,
        unit: p.unit ?? "pcs",
        qty_on_hand: p.inventory_on_hand?.[0]?.qty_on_hand ?? 0,
        updated_at: p.inventory_on_hand?.[0]?.updated_at ?? "",
      }));

      setRows(mapped);
    } catch (err) {
      console.error("InventoryTable fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = rows.filter((r) =>
    !search ||
    r.sku.toLowerCase().includes(search.toLowerCase()) ||
    r.product_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 bg-white">
      <div>
        <h1 className="text-2xl lg:text-4xl font-semibold mb-2 text-[#111827]">Inventory On-Hand</h1>
        <p className="text-sm lg:text-base text-[#6B7280]">Live stock levels from database</p>
      </div>

      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-[#111827] font-semibold">
              Stock Table
              {!loading && (
                <span className="ml-2 text-sm font-normal text-[#6B7280]">
                  {filtered.length} product{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm border border-[#111827]/10 rounded-md px-3 py-1.5 w-48 focus:outline-none focus:border-[#00A3AD]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
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
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">SKU</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">Product Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">Qty On-Hand</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#6B7280] whitespace-nowrap">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[#6B7280]">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-[#6B7280]">
                      {search ? "No products match your search." : "No inventory data found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => {
                    const isLow = row.qty_on_hand > 0 && row.qty_on_hand < MIN_STOCK_THRESHOLD;
                    const isZero = row.qty_on_hand === 0;
                    return (
                      <tr
                        key={row.product_id}
                        className={`border-b border-[#E5E7EB] transition-colors hover:bg-[#F8FAFC] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#6B7280] whitespace-nowrap">
                          {row.sku}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#111827]">
                          {row.product_name}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] capitalize">
                          {row.unit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full font-semibold text-sm ${
                              isZero
                                ? "bg-[#F97316]/10 text-[#F97316]"
                                : isLow
                                ? "bg-amber-100 text-amber-700"
                                : "text-[#111827]"
                            }`}
                          >
                            {row.qty_on_hand.toLocaleString()}
                          </span>
                          {isZero && (
                            <span className="ml-2 text-xs text-[#F97316] font-medium">Out of stock</span>
                          )}
                          {isLow && (
                            <span className="ml-2 text-xs text-amber-600 font-medium">Low</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">
                          {row.updated_at ? formatDate(row.updated_at) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
