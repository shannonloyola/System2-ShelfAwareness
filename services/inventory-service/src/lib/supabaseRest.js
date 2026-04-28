import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const productSelect =
  "product_id,product_uuid,sku,barcode,product_name,unit,reserved_stock,inventory_on_hand";

const inventorySelect = "product_id,bin_id,qty_on_hand,updated_at";

const backorderAlertSelect =
  "id,sku,message,grn_reference,pending_backorder_count,created_at";

const backorderAgingSelect =
  "backorder_id,order_uuid,order_no,retailer_name,sku,qty_backordered,created_at,age_days,latest_status";

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
    return response.json();
  }

  const body = await response.text();
  throw new Error(body || `Supabase REST request failed with ${response.status}`);
};

const computeStatus = (qty) => {
  if (qty === 0) return "zero";
  if (qty < 500) return "low";
  return "normal";
};

const mapInventoryRows = (products, onHandRows) => {
  const onHandByProductKey = new Map(
    onHandRows.map((row) => [String(row.product_id), row]),
  );

  return products.map((product) => {
    const inventory =
      onHandByProductKey.get(String(product.product_uuid)) ??
      onHandByProductKey.get(String(product.product_id)) ??
      null;
    const systemCount = Number(
      inventory?.qty_on_hand ?? product.inventory_on_hand ?? 0,
    );

    return {
      id: String(product.product_id),
      productUuid: product.product_uuid ? String(product.product_uuid) : null,
      sku: product.sku ?? "N/A",
      barcode: String(product.barcode ?? ""),
      name: product.product_name ?? "Unknown Product",
      unit: product.unit ?? "-",
      reservedStock: Number(product.reserved_stock ?? 0),
      lastUpdated: inventory?.updated_at ?? null,
      systemCount,
      status: computeStatus(systemCount),
    };
  });
};

const pickBinId = async () => {
  const headers = buildHeaders();

  const inventoryLookup = await fetch(
    `${env.supabaseUrl}/rest/v1/inventory_on_hand?select=bin_id&limit=1`,
    {
      method: "GET",
      headers,
    },
  );

  if (inventoryLookup.ok) {
    const rows = await inventoryLookup.json();
    if (rows?.length > 0 && rows[0].bin_id) {
      return String(rows[0].bin_id);
    }
  }

  const binsLookup = await fetch(`${env.supabaseUrl}/rest/v1/bins?select=id&limit=1`, {
    method: "GET",
    headers,
  });

  if (binsLookup.ok) {
    const rows = await binsLookup.json();
    if (rows?.length > 0 && rows[0].id) {
      return String(rows[0].id);
    }
  }

  throw createHttpError(500, "Cannot sync stock: no bin available");
};

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

export const listInventoryRest = async ({ limit, offset, search }) => {
  ensureRestConfig();

  const productsUrl = new URL(`${env.supabaseUrl}/rest/v1/products`);
  productsUrl.searchParams.set("select", productSelect);
  productsUrl.searchParams.set("order", "product_name.asc");
  productsUrl.searchParams.set("limit", String(limit));
  productsUrl.searchParams.set("offset", String(offset));

  if (search) {
    productsUrl.searchParams.set(
      "or",
      `(sku.ilike.*${search}*,product_name.ilike.*${search}*,barcode.ilike.*${search}*)`,
    );
  }

  const [products, onHandRows] = await Promise.all([
    handleResponse(
      await fetch(productsUrl, {
        method: "GET",
        headers: buildHeaders(),
      }),
    ),
    handleResponse(
      await fetch(`${env.supabaseUrl}/rest/v1/inventory_on_hand?select=${inventorySelect}`, {
        method: "GET",
        headers: buildHeaders(),
      }),
    ),
  ]);

  return mapInventoryRows(products, onHandRows);
};

export const getInventoryItemRest = async (productId) => {
  ensureRestConfig();

  const productRes = await fetch(
    `${env.supabaseUrl}/rest/v1/products?select=${productSelect}&product_id=eq.${encodeURIComponent(productId)}&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );
  const products = await handleResponse(productRes);
  if (!products?.length) {
    return null;
  }

  const inventoryRes = await fetch(
    `${env.supabaseUrl}/rest/v1/inventory_on_hand?select=${inventorySelect}&or=(product_id.eq.${encodeURIComponent(productId)}${products[0].product_uuid ? `,product_id.eq.${encodeURIComponent(products[0].product_uuid)}` : ""})`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );
  const onHandRows = await handleResponse(inventoryRes);

  return mapInventoryRows(products, onHandRows)[0] ?? null;
};

export const receiveScanRest = async ({
  product_id,
  product_uuid,
  reserved_stock,
  increment,
}) => {
  ensureRestConfig();

  const headers = buildHeaders();
  const productKeys = [product_uuid, product_id].filter(Boolean);

  let synced = false;
  let nextOnHand = increment;

  for (const productKey of productKeys) {
    const lookupRes = await fetch(
      `${env.supabaseUrl}/rest/v1/inventory_on_hand?select=product_id,bin_id,qty_on_hand&product_id=eq.${encodeURIComponent(productKey)}&limit=1`,
      {
        method: "GET",
        headers,
      },
    );

    if (!lookupRes.ok) {
      continue;
    }

    const lookupRows = await lookupRes.json();
    if (lookupRows.length === 0) {
      continue;
    }

    const row = lookupRows[0];
    nextOnHand = Number(row.qty_on_hand ?? 0) + increment;

    const patchRes = await fetch(
      `${env.supabaseUrl}/rest/v1/inventory_on_hand?product_id=eq.${encodeURIComponent(row.product_id)}&bin_id=eq.${encodeURIComponent(row.bin_id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          qty_on_hand: nextOnHand,
        }),
      },
    );

    if (patchRes.ok) {
      synced = true;
      break;
    }
  }

  if (!synced) {
    const insertProductKey = product_uuid || product_id;
    const binId = await pickBinId();
    nextOnHand = increment;

    await handleResponse(
      await fetch(`${env.supabaseUrl}/rest/v1/inventory_on_hand`, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          product_id: insertProductKey,
          bin_id: binId,
          qty_on_hand: nextOnHand,
        }),
      }),
    );
  }

  const available = Math.max(0, nextOnHand - reserved_stock);

  await handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/products?product_id=eq.${encodeURIComponent(product_id)}`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          inventory_on_hand: nextOnHand,
          available_stock: available,
          available_to_promise: available,
        }),
      },
    ),
  );

  return {
    product_id,
    product_uuid,
    reserved_stock,
    increment,
    systemCount: nextOnHand,
    available_stock: available,
    available_to_promise: available,
    synced,
    status: computeStatus(nextOnHand),
    lastUpdated: new Date().toISOString(),
  };
};

export const listBackorderAlertsRest = async (limit) => {
  ensureRestConfig();

  return handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/backorder_alerts?select=${backorderAlertSelect}&order=created_at.desc&limit=${limit}`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );
};

export const listBackorderAgingRest = async (limit) => {
  ensureRestConfig();

  return handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/v_backorder_aging?select=${backorderAgingSelect}&order=created_at.asc&limit=${limit}`,
      {
        method: "GET",
        headers: buildHeaders(),
      },
    ),
  );
};
