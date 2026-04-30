import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const productSelect =
  "product_id,sku,product_name,barcode,inventory_on_hand";

const buildHeaders = () => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
  "Content-Type": "application/json",
});

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not set");
  }
};

const handleResponse = async (response) => {
  if (response.ok) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  const body = await response.text();
  throw createHttpError(
    response.status,
    body || `Supabase request failed with ${response.status}`,
  );
};

const mapProduct = (row) => ({
  id: row.product_id ?? row.id ?? "",
  sku: String(row.sku ?? "N/A"),
  product_name: String(row.product_name ?? "Unknown Product"),
  barcode: row.barcode ? String(row.barcode) : null,
  inventory_on_hand: Number(row.inventory_on_hand ?? 0),
});

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/products?select=product_id&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const listShelfItemsRest = async ({ limit }) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", productSelect);
  url.searchParams.set("order", "product_name.asc");
  url.searchParams.set("limit", String(limit));

  const rows = await handleResponse(
    await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );

  return (rows ?? []).map(mapProduct);
};

export const getProductByBarcodeRest = async (barcode) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", productSelect);
  url.searchParams.set("barcode", `eq.${barcode}`);
  url.searchParams.set("limit", "1");

  const rows = await handleResponse(
    await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapProduct(rows[0]);
};

export const getProductBySkuRest = async (sku) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", productSelect);
  url.searchParams.set("sku", `eq.${sku}`);
  url.searchParams.set("limit", "1");

  const rows = await handleResponse(
    await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return mapProduct(rows[0]);
};
