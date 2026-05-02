import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

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
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  const body = await response.text();
  throw new Error(body || `Supabase REST request failed with ${response.status}`);
};

const buildOrdersSelect =
  "po_id,po_no,supplier_name,status,created_at,paid_at,expected_delivery_date,preferred_communication";

const buildItemsSelect =
  "po_item_id,po_id,item_name,quantity";

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_orders?select=po_id&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const listPurchaseOrdersRest = async ({
  limit,
  offset,
  search,
  status,
}) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set("select", buildOrdersSelect);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order", "created_at.desc");

  if (search) {
    url.searchParams.set(
      "or",
      `(po_no.ilike.*${search}*,supplier_name.ilike.*${search}*)`,
    );
  }

  if (status) {
    url.searchParams.set("status", `ilike.${status}`);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const getPurchaseOrderByIdRest = async (poId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set("select", buildOrdersSelect);
  url.searchParams.set("po_id", `eq.${poId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  const data = await handleResponse(response);
  return data[0] ?? null;
};

export const createPurchaseOrderRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/purchase_orders`, {
    method: "POST",
    headers: {
      ...buildHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  return data[0] ?? null;
};

export const updatePurchaseOrderRest = async (poId, payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_orders?po_id=eq.${poId}`,
    {
      method: "PATCH",
      headers: {
        ...buildHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await handleResponse(response);
  if (Array.isArray(data) && data[0]) {
    return data[0];
  }

  throw createHttpError(
    403,
    "Purchase order update was not applied. Check Supabase update permissions or RLS policies for the purchase_orders table.",
  );
};

export const deletePurchaseOrderRest = async (poId) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_orders?po_id=eq.${poId}`,
    {
      method: "DELETE",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
    },
  );

  await handleResponse(response);
};

export const listPurchaseOrderItemsRest = async (poId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_order_items`);
  url.searchParams.set("select", buildItemsSelect);
  url.searchParams.set("po_id", `eq.${poId}`);
  url.searchParams.set("order", "po_item_id.asc");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const createPurchaseOrderItemRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_order_items`,
    {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await handleResponse(response);
  return data[0] ?? null;
};

export const updatePurchaseOrderItemRest = async (poId, poItemId, payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_order_items?po_id=eq.${poId}&po_item_id=eq.${poItemId}`,
    {
      method: "PATCH",
      headers: {
        ...buildHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await handleResponse(response);
  if (Array.isArray(data) && data[0]) {
    return data[0];
  }

  throw createHttpError(
    403,
    "Purchase order item update was not applied. Check Supabase update permissions or RLS policies for the purchase_order_items table.",
  );
};

export const deletePurchaseOrderItemRest = async (poId, poItemId) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/purchase_order_items?po_id=eq.${poId}&po_item_id=eq.${poItemId}`,
    {
      method: "DELETE",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
    },
  );

  await handleResponse(response);
};
