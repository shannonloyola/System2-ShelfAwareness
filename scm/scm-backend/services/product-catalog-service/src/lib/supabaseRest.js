import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const productSelect =
  "product_id,product_uuid,sku,product_name,unit,category,category_id,barcode,supplier,warehouse_location,unit_price,currency_code,inventory_on_hand,created_at";

const pricingSelect =
  "pricing_id,product_id,cost_price,selling_price,currency_code,effective_from,effective_to,created_at,created_by,updated_at,updated_by,is_active";

const categorySelect = "id,name,parent_id";

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

const mapProductRow = (row, inventoryByProductId = new Map()) => {
  const inventory = inventoryByProductId.get(String(row.product_id));
  return {
    product_id: row.product_id,
    product_uuid: row.product_uuid ?? null,
    sku: row.sku ?? "",
    product_name: row.product_name ?? "",
    unit: row.unit ?? null,
    category: row.category ?? null,
    category_id: row.category_id ?? null,
    barcode: row.barcode ?? "",
    supplier: row.supplier ?? "",
    warehouse_location: row.warehouse_location ?? "",
    unit_price: Number(row.unit_price ?? 0),
    currency_code: row.currency_code ?? "PHP",
    inventory_on_hand: Number(
      inventory?.qty_on_hand ?? row.inventory_on_hand ?? 0,
    ),
    inventory_updated_at: inventory?.updated_at ?? null,
    created_at: row.created_at ?? null,
  };
};

const fetchInventoryViewRest = async () => {
  const url = new URL(`${env.supabaseUrl}/rest/v1/v_products_with_inventory`);
  url.searchParams.set("select", "product_id,qty_on_hand,updated_at");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  return handleResponse(response);
};

const syncInventoryOnHandRest = async (productKey, quantity) => {
  const headers = buildHeaders();
  const encodedKey = encodeURIComponent(String(productKey));

  const existingRes = await fetch(
    `${env.supabaseUrl}/rest/v1/inventory_on_hand?select=product_id,bin_id&product_id=eq.${encodedKey}&limit=1`,
    {
      method: "GET",
      headers,
    },
  );
  const existingRows = existingRes.ok ? await existingRes.json() : [];

  if (existingRows.length > 0) {
    const row = existingRows[0];
    await handleResponse(
      await fetch(
        `${env.supabaseUrl}/rest/v1/inventory_on_hand?product_id=eq.${encodeURIComponent(row.product_id)}&bin_id=eq.${encodeURIComponent(row.bin_id)}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ qty_on_hand: quantity }),
        },
      ),
    );
    return;
  }

  let binId = null;
  const binLookup = await fetch(
    `${env.supabaseUrl}/rest/v1/inventory_on_hand?select=bin_id&limit=1`,
    {
      method: "GET",
      headers,
    },
  );
  if (binLookup.ok) {
    const rows = await binLookup.json();
    binId = rows?.[0]?.bin_id ?? null;
  }

  if (!binId) {
    const binsTableLookup = await fetch(
      `${env.supabaseUrl}/rest/v1/bins?select=id&limit=1`,
      {
        method: "GET",
        headers,
      },
    );
    if (binsTableLookup.ok) {
      const rows = await binsTableLookup.json();
      binId = rows?.[0]?.id ?? null;
    }
  }

  if (!binId) {
    throw createHttpError(500, "Cannot sync stock: no bin available");
  }

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/inventory_on_hand`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        product_id: productKey,
        bin_id: binId,
        qty_on_hand: quantity,
      }),
    }),
  );
};

export const upsertProductPricingRest = async ({
  product_id,
  selling_price,
  cost_price,
  currency_code,
  actor = "product_catalog_service",
}) => {
  ensureRestConfig();

  const headers = buildHeaders();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const normalizedCurrency = (currency_code || "PHP").trim();

  const activeRes = await fetch(
    `${env.supabaseUrl}/rest/v1/product_pricing?select=pricing_id,cost_price,selling_price,currency_code,is_active&product_id=eq.${product_id}&is_active=eq.true&order=effective_from.desc,created_at.desc&limit=1`,
    {
      method: "GET",
      headers,
    },
  );

  const activeRows = await handleResponse(activeRes);
  const currentRecord = activeRows?.[0] ?? null;

  const nextSellingPrice = Number(selling_price ?? 0);
  const nextCostPrice = Number(cost_price ?? 0);

  if (
    currentRecord &&
    Number(currentRecord.selling_price ?? 0) === nextSellingPrice &&
    Number(currentRecord.cost_price ?? 0) === nextCostPrice &&
    String(currentRecord.currency_code || "PHP") === normalizedCurrency
  ) {
    return false;
  }

  if (currentRecord?.pricing_id && currentRecord.is_active) {
    await handleResponse(
      await fetch(
        `${env.supabaseUrl}/rest/v1/product_pricing?pricing_id=eq.${currentRecord.pricing_id}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            is_active: false,
            effective_to: today,
            updated_at: nowIso,
            updated_by: actor,
          }),
        },
      ),
    );
  }

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/product_pricing`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        product_id,
        cost_price: nextCostPrice,
        selling_price: nextSellingPrice,
        currency_code: normalizedCurrency,
        effective_from: today,
        is_active: true,
        created_by: actor,
      }),
    }),
  );

  return true;
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

export const listProductsRest = async ({ limit, offset, search }) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", productSelect);
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  if (search) {
    url.searchParams.set(
      "or",
      `(sku.ilike.*${search}*,product_name.ilike.*${search}*,barcode.ilike.*${search}*)`,
    );
  }

  const [products, inventoryRows] = await Promise.all([
    handleResponse(
      await fetch(url, {
        method: "GET",
        headers: buildHeaders(),
      }),
    ),
    fetchInventoryViewRest(),
  ]);

  const inventoryByProductId = new Map(
    (inventoryRows || []).map((row) => [
      String(row.product_id),
      {
        qty_on_hand: Number(row.qty_on_hand ?? 0),
        updated_at: row.updated_at ?? null,
      },
    ]),
  );

  return (products || []).map((row) => mapProductRow(row, inventoryByProductId));
};

export const getProductByIdRest = async (productId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", productSelect);
  url.searchParams.set("product_id", `eq.${productId}`);
  url.searchParams.set("limit", "1");

  const [products, inventoryRows] = await Promise.all([
    handleResponse(
      await fetch(url, {
        method: "GET",
        headers: buildHeaders(),
      }),
    ),
    fetchInventoryViewRest(),
  ]);

  const row = products?.[0] ?? null;
  if (!row) {
    return null;
  }

  const inventoryByProductId = new Map(
    (inventoryRows || []).map((inventoryRow) => [
      String(inventoryRow.product_id),
      {
        qty_on_hand: Number(inventoryRow.qty_on_hand ?? 0),
        updated_at: inventoryRow.updated_at ?? null,
      },
    ]),
  );

  return mapProductRow(row, inventoryByProductId);
};

export const listCategoriesRest = async () => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/product_categories`);
  url.searchParams.set("select", categorySelect);
  url.searchParams.set("order", "name.asc");

  return handleResponse(
    await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );
};

export const listPricingHistoryRest = async () => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/product_pricing`);
  url.searchParams.set("select", pricingSelect);
  url.searchParams.set("order", "effective_from.desc,created_at.desc");

  return handleResponse(
    await fetch(url, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );
};

export const createProductRest = async (payload) => {
  ensureRestConfig();

  const insertPayload = {
    sku: payload.sku,
    product_name: payload.product_name,
    category_id: payload.category_id,
    category: payload.category ?? null,
    unit: payload.unit ?? "pcs",
    barcode: payload.barcode,
    supplier: payload.supplier,
    warehouse_location: payload.warehouse_location,
    unit_price: payload.unit_price ?? 0,
    currency_code: payload.currency_code ?? "PHP",
    inventory_on_hand: payload.inventory_on_hand ?? 0,
    created_at: payload.created_at ?? new Date().toISOString(),
  };

  const rows = await handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/products?select=${encodeURIComponent(productSelect)}`,
      {
        method: "POST",
        headers: {
          ...buildHeaders(),
          Prefer: "return=representation",
        },
        body: JSON.stringify(insertPayload),
      },
    ),
  );

  const row = rows?.[0] ?? null;
  if (!row) {
    throw createHttpError(500, "Failed to create product");
  }

  const productKey = row.product_uuid || row.product_id;
  await syncInventoryOnHandRest(productKey, Number(payload.inventory_on_hand ?? 0));
  await upsertProductPricingRest({
    product_id: row.product_id,
    selling_price: payload.unit_price ?? 0,
    cost_price: payload.cost_price ?? 0,
    currency_code: payload.currency_code ?? "PHP",
  });

  return mapProductRow(row);
};

export const updateProductRest = async (productId, payload) => {
  ensureRestConfig();

  const current = await getProductByIdRest(productId);
  if (!current) {
    throw createHttpError(404, "Product not found");
  }

  const patchPayload = {};
  const productFields = [
    "product_name",
    "category_id",
    "category",
    "unit",
    "barcode",
    "supplier",
    "warehouse_location",
    "unit_price",
    "currency_code",
    "inventory_on_hand",
  ];

  for (const field of productFields) {
    if (field in payload) {
      patchPayload[field] = payload[field];
    }
  }

  const rows = await handleResponse(
    await fetch(
      `${env.supabaseUrl}/rest/v1/products?product_id=eq.${productId}&select=${encodeURIComponent(productSelect)}`,
      {
        method: "PATCH",
        headers: {
          ...buildHeaders(),
          Prefer: "return=representation",
        },
        body: JSON.stringify(patchPayload),
      },
    ),
  );

  const row = rows?.[0] ?? null;
  if (!row) {
    throw createHttpError(404, "Product not found");
  }

  const stockQty =
    payload.inventory_on_hand !== undefined
      ? Number(payload.inventory_on_hand)
      : Number(current.inventory_on_hand ?? 0);
  const productKey = row.product_uuid || row.product_id;
  await syncInventoryOnHandRest(productKey, stockQty);

  await upsertProductPricingRest({
    product_id: row.product_id,
    selling_price:
      payload.unit_price !== undefined
        ? payload.unit_price
        : row.unit_price,
    cost_price:
      payload.cost_price !== undefined ? payload.cost_price : 0,
    currency_code:
      payload.currency_code !== undefined
        ? payload.currency_code
        : row.currency_code,
  });

  return mapProductRow({
    ...row,
    inventory_on_hand: stockQty,
  });
};

export const deleteProductRest = async (productId) => {
  ensureRestConfig();

  const current = await getProductByIdRest(productId);
  if (!current) {
    throw createHttpError(404, "Product not found");
  }

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/products?product_id=eq.${productId}`, {
      method: "DELETE",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
    }),
  );

  const productKey = current.product_uuid || current.product_id;
  await fetch(
    `${env.supabaseUrl}/rest/v1/inventory_on_hand?product_id=eq.${encodeURIComponent(productKey)}`,
    {
      method: "DELETE",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
    },
  );

  return { product_id: productId };
};

export const importProductsRest = async (products) => {
  const created = [];
  for (const product of products) {
    created.push(await createProductRest(product));
  }
  return created;
};
