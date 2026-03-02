import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import bwipjs from "bwip-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #print-area,
  #print-area * { visibility: visible !important; }
  #print-area {
    position: fixed !important;
    inset: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #fff !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  @page { size: 62mm 29mm; margin: 0; }
}
`;

function injectPrintStyles() {
  if (document.getElementById("barcode-print-styles")) return;
  const style = document.createElement("style");
  style.id = "barcode-print-styles";
  style.textContent = PRINT_STYLES;
  document.head.appendChild(style);
}

function drawBarcode(canvas, barcodeValue) {
  return bwipjs.toCanvas(canvas, {
    bcid: "ean13",
    text: barcodeValue,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    textsize: 11,
  });
}

function LabelCard({ product, onPrint }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !product.barcode) return;
    try {
      drawBarcode(canvasRef.current, product.barcode);
      setError(null);
    } catch (e) {
      setError("Invalid barcode: " + product.barcode);
    }
  }, [product.barcode]);

  return (
    <div className="label-card">
      <div className="label-meta">
        <span className="label-sku">{product.sku}</span>
        <span className="label-name">{product.product_name}</span>
        {product.unit_price != null && (
          <span className="label-price">
            {product.currency_code ?? "PHP"}{" "}
            {Number(product.unit_price).toFixed(2)}
          </span>
        )}
      </div>

      <div className="label-barcode-wrap">
        {error ? (
          <p className="barcode-error">{error}</p>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>

      <button
        className="btn-print"
        disabled={!!error}
        onClick={() => onPrint(product)}
      >
        🖨 Print Label
      </button>
    </div>
  );
}

function PrintArea({ product }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!product || !canvasRef.current) return;
    try {
      drawBarcode(canvasRef.current, product.barcode);
    } catch (_) {}
  }, [product]);

  if (!product) return null;

  return (
    <div id="print-area">
      <div className="thermal-label">
        <div className="thermal-name">{product.product_name}</div>
        <canvas ref={canvasRef} />
        <div className="thermal-sku">{product.sku}</div>
      </div>
    </div>
  );
}

export default function BarcodeLabel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [printTarget, setPrintTarget] = useState(null);

  useEffect(() => {
    injectPrintStyles();
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("product_id, sku, product_name, barcode, unit_price, currency_code")
      .not("barcode", "is", null)
      .order("product_name");

    if (!error) setProducts(data ?? []);
    setLoading(false);
  }

  function handlePrint(product) {
    setPrintTarget(product);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }

  const filtered = products.filter(
    (p) =>
      p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f0f0f; }
        .blg-root {
          min-height: 100vh;
          background: #0f0f0f;
          color: #e8e3d8;
          font-family: 'Courier New', Courier, monospace;
          padding: 2.5rem 2rem;
        }
        .blg-header {
          max-width: 960px;
          margin: 0 auto 2.5rem;
          border-bottom: 1px solid #2a2a2a;
          padding-bottom: 1.5rem;
        }
        .blg-title {
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #f5f0e8;
          font-weight: 400;
        }
        .blg-title span { color: #c8a96e; }
        .blg-subtitle {
          font-size: 0.75rem;
          letter-spacing: 0.3em;
          color: #555;
          margin-top: 0.4rem;
          text-transform: uppercase;
        }
        .blg-search { max-width: 960px; margin: 0 auto 2rem; }
        .blg-search input {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #2e2e2e;
          color: #e8e3d8;
          font-family: inherit;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
          padding: 0.75rem 1rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .blg-search input:focus { border-color: #c8a96e; }
        .blg-search input::placeholder { color: #444; }
        .blg-grid {
          max-width: 960px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 1.25rem;
        }
        .label-card {
          background: #161616;
          border: 1px solid #232323;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          transition: border-color 0.2s, transform 0.15s;
        }
        .label-card:hover { border-color: #c8a96e44; transform: translateY(-2px); }
        .label-meta { display: flex; flex-direction: column; gap: 0.2rem; }
        .label-sku { font-size: 0.65rem; letter-spacing: 0.25em; color: #c8a96e; text-transform: uppercase; }
        .label-name { font-size: 0.88rem; color: #e8e3d8; line-height: 1.3; }
        .label-price { font-size: 0.75rem; color: #888; margin-top: 0.15rem; }
        .label-barcode-wrap {
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          min-height: 70px;
        }
        .label-barcode-wrap canvas { display: block; max-width: 100%; }
        .barcode-error { font-size: 0.7rem; color: #e07070; text-align: center; }
        .btn-print {
          background: transparent;
          border: 1px solid #c8a96e66;
          color: #c8a96e;
          font-family: inherit;
          font-size: 0.72rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          padding: 0.55rem 0;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          width: 100%;
        }
        .btn-print:hover:not(:disabled) { background: #c8a96e18; border-color: #c8a96e; }
        .btn-print:disabled { opacity: 0.3; cursor: not-allowed; }
        .blg-empty { max-width: 960px; margin: 2rem auto; text-align: center; color: #444; letter-spacing: 0.15em; font-size: 0.8rem; text-transform: uppercase; }
        .thermal-label { display: flex; flex-direction: column; align-items: center; gap: 2mm; padding: 2mm 3mm; font-family: 'Courier New', monospace; }
        .thermal-name { font-size: 9pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; }
        .thermal-sku { font-size: 7pt; letter-spacing: 0.1em; color: #333; }
        #print-area { display: none; }
      `}</style>

      <div className="blg-root">
        <header className="blg-header">
          <h1 className="blg-title">Barcode <span>Label</span> Generator</h1>
          <p className="blg-subtitle">Shelf Awareness · Supply Chain Inventory</p>
        </header>

        <div className="blg-search">
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="blg-empty">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="blg-empty">No products with barcodes found.</p>
        ) : (
          <div className="blg-grid">
            {filtered.map((p) => (
              <LabelCard key={p.product_id} product={p} onPrint={handlePrint} />
            ))}
          </div>
        )}
      </div>

      <PrintArea product={printTarget} />
    </>
  );
}