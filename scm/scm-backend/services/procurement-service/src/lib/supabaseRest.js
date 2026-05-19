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
  const text = await response.text();
  
  if (response.ok) {
    if (response.status === 204 || !text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  let message = text;
  let details = null;
  let pgCode = null;

  try {
    const errorJson = JSON.parse(text);
    message = errorJson.message || errorJson.error || text;
    details = errorJson.details || errorJson.hint || null;
    pgCode = errorJson.code || null; // Postgres error code e.g. "23505"
  } catch (e) {
    // Not JSON, use raw text
  }

  const err = createHttpError(
    response.status === 404 ? 404 : 500,
    message || `Supabase REST request failed with ${response.status}`,
    details,
  );
  if (pgCode) err.code = pgCode;
  throw err;
};

const buildOrdersSelect =
  "po_id,po_no,supplier_name,status,created_at,paid_at,expected_delivery_date,preferred_communication,approval_status,approved_by,approved_at,rejected_at,rejection_reason,is_late,customs_entry_date,customs_release_date,duties_paid,transit_status,transit_updated_at,transit_updated_by,transit_notes,carrier_name,carrier_tracking_ref,freight_mode,freight_cost,freight_type,reserved_at,expires_at,purchase_order_items(count)";

const buildItemsSelect =
  "po_item_id,po_id,item_name,quantity";

const buildStatusHistorySelect =
  "history_id,po_id,status_name,changed_at,document_url,reason";

const buildFreightQuotesSelect =
  "id,po_id,po_no,provider,freight_type,cost,estimated_days,is_winner,created_at,updated_at";

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

export const listFreightQuotesRest = async (poId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/freight_quotes`);
  url.searchParams.set("select", buildFreightQuotesSelect);
  url.searchParams.set("po_id", `eq.${poId}`);
  url.searchParams.set("order", "created_at.asc");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const createFreightQuoteRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/freight_quotes`, {
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

export const updateFreightQuoteRest = async (poId, quoteId, payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/freight_quotes?po_id=eq.${poId}&id=eq.${quoteId}`,
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
  return data[0] ?? null;
};

export const clearWinnerFreightQuotesRest = async (poId, keepQuoteId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/freight_quotes`);
  url.searchParams.set("po_id", `eq.${poId}`);
  url.searchParams.set("id", `neq.${keepQuoteId}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...buildHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ is_winner: false, updated_at: new Date().toISOString() }),
  });

  await handleResponse(response);
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

export const listPurchaseOrderStatusHistoryRest = async (poId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/po_status_history`);
  url.searchParams.set("select", buildStatusHistorySelect);
  url.searchParams.set("po_id", `eq.${poId}`);
  url.searchParams.set("order", "changed_at.desc");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const createPurchaseOrderStatusHistoryRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/po_status_history`, {
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

export const updatePurchaseOrderStatusHistoryRest = async (
  historyId,
  payload,
) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/po_status_history?history_id=eq.${historyId}`,
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
  return data[0] ?? null;
};

export const runExpireReservationsRest = async () => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/rpc/expire_reservations`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({}),
  });

  return handleResponse(response);
};

export const listExpiringSoonReservationsRest = async (beforeIso) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set(
    "select",
    "po_id,po_no,supplier_name,status,expires_at,reserved_at",
  );
  url.searchParams.set("expires_at", `lte.${beforeIso}`);
  url.searchParams.set("status", "not.in.(Paid,Expired,Cancelled)");
  url.searchParams.set("order", "expires_at.asc");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const listExpiredReservationsRest = async () => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set("select", buildOrdersSelect);
  url.searchParams.set("status", "eq.Expired");
  url.searchParams.set("order", "expires_at.desc");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const getCurrentMonthlyBudgetRest = async (month, year) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/monthly_budgets`);
  url.searchParams.set("select", "allocated_amount,spent_amount,month,year");
  url.searchParams.set("month", `eq.${month}`);
  url.searchParams.set("year", `eq.${year}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  const data = await handleResponse(response);
  return data[0] ?? null;
};

export const listCustomsTrackedPurchaseOrdersRest = async () => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set(
    "select",
    "po_id,po_no,supplier_name,customs_entry_date,customs_release_date,transit_status",
  );
  url.searchParams.set("customs_entry_date", "not.is.null");
  url.searchParams.set("order", "customs_entry_date.asc");

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
