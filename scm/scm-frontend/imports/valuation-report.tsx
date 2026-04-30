import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ValueBasis = "cost" | "unit";

interface ProductRow {
  product_id: number;
  sku: string | null;
  product_name: string | null;
  category: string | null;
  warehouse_location: string | null;
  unit_price: number | null;
  currency_code: string | null;
}

interface InventoryRow {
  product_id: number;
  qty_on_hand: number | null;
  updated_at: string | null;
}

interface PriceRow {
  product_id: number;
  cost_price: number | null;
}

interface ValuationRow {
  product_id: number;
  sku: string;
  product_name: string;
  category: string;
  location: string;
  qty_on_hand: number;
  cost_price: number;
  unit_price: number;
  currency_code: string;
  updated_at: string | null;
}

const formatMoney = (value: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function ValuationReport() {
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [basis, setBasis] = useState<ValueBasis>("unit");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: products, error: pErr }, { data: inventory, error: iErr }, { data: pricing, error: prErr }] =
        await Promise.all([
          supabase.from("products").select("product_id,sku,product_name,category,warehouse_location,unit_price,currency_code"),
          supabase.from("v_products_with_inventory").select("product_id,qty_on_hand,updated_at"),
          supabase.from("v_latest_product_cost_price").select("product_id,cost_price"),
        ]);
      setLoading(false);

      if (pErr) {
        console.error("load products error", pErr);
        setRows([]);
        return;
      }
      if (iErr) console.error("load inventory error", iErr);
      if (prErr) console.error("load pricing error", prErr);

      const invMap = new Map<number, InventoryRow>(
        ((inventory ?? []) as InventoryRow[]).map((x) => [Number(x.product_id), x]),
      );
      const costMap = new Map<number, number>(
        ((pricing ?? []) as PriceRow[]).map((x) => [Number(x.product_id), Number(x.cost_price ?? 0)]),
      );

      const mapped: ValuationRow[] = ((products ?? []) as ProductRow[]).map((p) => {
        const pid = Number(p.product_id);
        const inv = invMap.get(pid);
        return {
          product_id: pid,
          sku: p.sku ?? "N/A",
          product_name: p.product_name ?? "Unnamed product",
          category: p.category?.trim() || "Uncategorized",
          location: p.warehouse_location?.trim() || "Unassigned",
          qty_on_hand: Number(inv?.qty_on_hand ?? 0),
          cost_price: Number(costMap.get(pid) ?? 0),
          unit_price: Number(p.unit_price ?? 0),
          currency_code: (p.currency_code || "PHP").toUpperCase(),
          updated_at: inv?.updated_at ?? null,
        };
      });

      setRows(mapped);
    };

    load();
  }, []);

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.location))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        keyword &&
        !r.sku.toLowerCase().includes(keyword) &&
        !r.product_name.toLowerCase().includes(keyword) &&
        !r.category.toLowerCase().includes(keyword) &&
        !r.location.toLowerCase().includes(keyword)
      ) {
        return false;
      }
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (locationFilter !== "ALL" && r.location !== locationFilter) return false;
      if (dateFrom || dateTo) {
        if (!r.updated_at) return false;
        const d = new Date(r.updated_at);
        if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
        if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [rows, searchTerm, categoryFilter, locationFilter, dateFrom, dateTo]);

  const withValue = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        applied_price: basis === "cost" ? r.cost_price : r.unit_price,
        inventory_value: r.qty_on_hand * (basis === "cost" ? r.cost_price : r.unit_price),
      })),
    [filtered, basis],
  );

  const sortedWithValue = useMemo(() => {
    return [...withValue].sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [withValue]);

  const totalsByCurrency = useMemo(() => {
    if (basis !== "unit") return [];
    const map = new Map<string, number>();
    for (const row of sortedWithValue) {
      const code = row.currency_code || "PHP";
      map.set(code, (map.get(code) ?? 0) + row.inventory_value);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [basis, sortedWithValue]);

  const total = useMemo(
    () => sortedWithValue.reduce((sum, r) => sum + r.inventory_value, 0),
    [sortedWithValue],
  );

  const exportCsv = () => {
    const headers = [
      "Date Updated",
      "Category",
      "Location",
      "SKU",
      "Product",
      "Qty",
      "Applied Price",
      "Inventory Value",
      "Currency",
      "Basis",
    ];

    const lines = [
      headers.join(","),
      ...sortedWithValue.map((r) =>
        [
          r.updated_at ? new Date(r.updated_at).toLocaleString() : "N/A",
          r.category,
          r.location,
          r.sku,
          r.product_name,
          r.qty_on_hand,
          r.applied_price.toFixed(2),
          r.inventory_value.toFixed(2),
          basis === "unit" ? r.currency_code : "PHP",
          basis === "cost" ? "cost_price x qty" : "unit_price x qty",
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      ),
      "",
      `,,,,,,Total Inventory Value (PHP),"${total.toFixed(2)}","${basis === "cost" ? "cost_price x qty" : "unit_price x qty"}"`,
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `valuation_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Valuation Report</h2>
          <p className="text-sm text-[#6B7280]">
            Filter by date, category, and location. Choose valuation basis then export to Excel.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-lg border border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 text-sm font-medium"
        >
          Export to Excel
        </button>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
        <div>
          <label className="text-xs text-[#6B7280]">Search</label>
          <input
            className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm"
            type="text"
            placeholder="SKU / product / category / location"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-[#6B7280]">Date From</label>
          <input className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[#6B7280]">Date To</label>
          <input className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-[#6B7280]">Category</label>
          <select className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="ALL">All Categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B7280]">Location</label>
          <select className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="ALL">All Locations</option>
            {locationOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[#6B7280]">Value Basis</label>
          <select className="w-full mt-1 border border-[#E5E7EB] rounded-md px-2 py-2 text-sm" value={basis} onChange={(e) => setBasis(e.target.value as ValueBasis)}>
            <option value="cost">Cost Price x Qty</option>
            <option value="unit">Unit Price x Qty</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="text-xs text-[#6B7280]">Total Inventory Value</div>
          {basis === "unit" ? (
            <div className="space-y-1">
              {totalsByCurrency.map(([code, amount]) => (
                <div key={code} className="text-sm font-bold text-[#1A2B47]">
                  {formatMoney(amount, code)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-lg font-bold text-[#1A2B47]">{formatMoney(total, "PHP")}</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-auto">
        {loading ? (
          <p className="p-6 text-sm text-[#6B7280]">Loading valuation rows...</p>
        ) : sortedWithValue.length === 0 ? (
          <p className="p-6 text-sm text-[#6B7280]">No rows found for selected filters.</p>
        ) : (
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">Date Updated</th>
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">Category</th>
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">Location</th>
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">SKU</th>
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">Product</th>
                <th className="text-right px-3 py-2 text-[#6B7280] font-semibold">Qty</th>
                <th className="text-right px-3 py-2 text-[#6B7280] font-semibold">Applied Price</th>
                <th className="text-right px-3 py-2 text-[#6B7280] font-semibold">Inventory Value</th>
                <th className="text-left px-3 py-2 text-[#6B7280] font-semibold">Currency</th>
              </tr>
            </thead>
            <tbody>
              {sortedWithValue.map((r) => (
                <tr key={r.product_id} className="border-b border-[#F3F4F6]">
                  <td className="px-3 py-2 text-[#6B7280]">{r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "N/A"}</td>
                  <td className="px-3 py-2 text-[#111827]">{r.category}</td>
                  <td className="px-3 py-2 text-[#111827]">{r.location}</td>
                  <td className="px-3 py-2 font-mono text-[#111827]">{r.sku}</td>
                  <td className="px-3 py-2 text-[#111827]">{r.product_name}</td>
                  <td className="px-3 py-2 text-right text-[#111827]">{r.qty_on_hand}</td>
                  <td className="px-3 py-2 text-right text-[#111827]">
                    {formatMoney(r.applied_price, basis === "unit" ? r.currency_code : "PHP")}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-[#1A2B47]">
                    {formatMoney(r.inventory_value, basis === "unit" ? r.currency_code : "PHP")}
                  </td>
                  <td className="px-3 py-2 text-[#111827]">{basis === "unit" ? r.currency_code : "PHP"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
