import { useEffect, useMemo, useState } from "react";

interface ValuationRow {
  product_id: number;
  sku: string;
  product_name: string;
  category: string;
  location: string;
  qty_on_hand: number;
  unit_price: number;
  currency_code: string;
}

const formatMoney = (value: number, currency = "PHP") =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const SCM_URL = "https://wbktqkjdsqrvqxxtitsg.supabase.co";
const SCM_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India3Rxa2pkc3FydnF4eHRpdHNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzQ2MTIsImV4cCI6MjA5NDA1MDYxMn0.rWnlQ2PZVAWnK5kao1GPgHHexqCquzD9XE711MWOfck";

export default function EvaluationReport() {
  const [rows, setRows] = useState<ValuationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [locFilter, setLocFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${SCM_URL}/rest/v1/products?select=product_id,sku,product_name,category,warehouse_location,unit_price,currency_code,inventory_on_hand`,
          { headers: { apikey: SCM_KEY, Authorization: `Bearer ${SCM_KEY}` } }
        );
        const data = await res.json();
        if (!Array.isArray(data)) {
          setErrorMsg(data?.message ?? "Unexpected response from database.");
          return;
        }
        setRows(
          data.map((p: any) => ({
            product_id: p.product_id,
            sku: p.sku ?? "N/A",
            product_name: p.product_name ?? "Unnamed",
            category: p.category?.trim() || "Uncategorized",
            location: p.warehouse_location?.trim() || "Main Warehouse",
            qty_on_hand: Number(p.inventory_on_hand ?? 0),
            unit_price: Number(p.unit_price ?? 0),
            currency_code: p.currency_code || "PHP",
          }))
        );
      } catch (e: any) {
        setErrorMsg(e.message ?? "Network error.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cats = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows]);
  const locs = useMemo(() => [...new Set(rows.map((r) => r.location))].sort(), [rows]);

  const filtered = useMemo(() => {
    const kw = search.toLowerCase();
    return rows.filter((r) => {
      if (kw && !r.sku.toLowerCase().includes(kw) && !r.product_name.toLowerCase().includes(kw)) return false;
      if (catFilter !== "ALL" && r.category !== catFilter) return false;
      if (locFilter !== "ALL" && r.location !== locFilter) return false;
      return true;
    });
  }, [rows, search, catFilter, locFilter]);

  const withVal = useMemo(
    () => filtered.map((r) => ({ ...r, inv_value: r.qty_on_hand * r.unit_price })),
    [filtered]
  );

  const grandTotal = useMemo(() => withVal.reduce((s, r) => s + r.inv_value, 0), [withVal]);

  const exportCsv = () => {
    const lines = [
      ["SKU", "Product", "Category", "Location", "Qty", "Unit Price", "Value", "Currency"].join(","),
      ...withVal.map((r) =>
        [r.sku, r.product_name, r.category, r.location, r.qty_on_hand, r.unit_price.toFixed(2), r.inv_value.toFixed(2), r.currency_code]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
      ),
      `,,,,,,${grandTotal.toFixed(2)},PHP`,
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `valuation_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Evaluation Report</h2>
          <p className="text-sm text-[#6B7280]">Inventory asset valuation — stock quantity × unit price.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={withVal.length === 0}
          className="px-4 py-2 rounded-lg border border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 text-sm font-medium disabled:opacity-40"
        >
          Export to CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Search</label>
          <input
            type="text"
            placeholder="SKU or product name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Category</label>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm"
          >
            <option value="ALL">All Categories</option>
            {cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#6B7280] mb-1">Location</label>
          <select
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm"
          >
            <option value="ALL">All Locations</option>
            {locs.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#6B7280]">Total Inventory Value</div>
          <div className="text-xl font-bold text-[#1A2B47]">{formatMoney(grandTotal)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-[#6B7280]">
            <div className="animate-spin w-6 h-6 border-2 border-[#00A3AD] border-t-transparent rounded-full mx-auto mb-2" />
            Loading valuation data...
          </div>
        ) : errorMsg ? (
          <div className="p-6 text-sm text-red-500 font-mono">⚠ Error: {errorMsg}</div>
        ) : withVal.length === 0 ? (
          <p className="p-6 text-sm text-[#6B7280]">No products found. Try adjusting filters.</p>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                {["SKU", "Product", "Category", "Location", "Qty on Hand", "Unit Price", "Inventory Value"].map((h) => (
                  <th
                    key={h}
                    className={`px-3 py-2 text-[#6B7280] font-semibold text-xs uppercase tracking-wide ${
                      ["Qty on Hand", "Unit Price", "Inventory Value"].includes(h) ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withVal.map((r) => (
                <tr key={r.product_id} className="border-b border-[#F3F4F6] hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-[#00A3AD]">{r.sku}</td>
                  <td className="px-3 py-2.5 font-medium text-[#111827]">{r.product_name}</td>
                  <td className="px-3 py-2.5">
                    <span className="bg-[#EFF6FF] text-[#1D4ED8] text-xs px-2 py-0.5 rounded-full">{r.category}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[#6B7280] text-xs">{r.location}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-[#111827]">{r.qty_on_hand.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-right text-[#6B7280]">{formatMoney(r.unit_price, r.currency_code)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#1A2B47]">{formatMoney(r.inv_value, r.currency_code)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F0FDF9] border-t-2 border-[#00A3AD]/20">
                <td colSpan={4} className="px-3 py-3 text-sm font-semibold text-[#6B7280]">
                  {withVal.length} product{withVal.length !== 1 ? "s" : ""}
                </td>
                <td className="px-3 py-3 text-right font-bold text-[#111827]">
                  {withVal.reduce((s, r) => s + r.qty_on_hand, 0).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right text-xs font-semibold text-[#6B7280]">Grand Total</td>
                <td className="px-3 py-3 text-right font-bold text-[#00A3AD] text-base">
                  {formatMoney(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
