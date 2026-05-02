import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const adjustmentSelect =
  "id,product_id,sku,product_name,qty_before,qty_change,qty_after,reason,reason_category,status,requested_by,approved_by,approved_at,rejection_note,created_at";

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not set");
  }
};

const getSupabaseHeaders = (requestHeaders = {}) => {
  const authorization = requestHeaders.authorization?.trim();

  return {
    apikey: env.supabaseAnonKey,
    Authorization: authorization || `Bearer ${env.supabaseAnonKey}`,
    "Content-Type": "application/json",
  };
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

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/stock_adjustments?select=id&limit=1`,
    {
      method: "GET",
      headers: getSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const listStockAdjustmentsRest = async ({ status, requestHeaders }) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/stock_adjustments`);
  url.searchParams.set("select", adjustmentSelect);
  url.searchParams.set("order", "created_at.desc");

  if (status) {
    url.searchParams.set("status", `eq.${status}`);
  }

  const payload = await handleResponse(
    await fetch(url, {
      method: "GET",
      headers: getSupabaseHeaders(requestHeaders),
    }),
  );

  return payload ?? [];
};

export const createStockAdjustmentRest = async ({ payload, requestHeaders }) => {
  ensureRestConfig();

  const createdRows = await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/stock_adjustments`, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(requestHeaders),
        Prefer: "return=representation",
      },
      body: JSON.stringify([payload]),
    }),
  );

  if (!Array.isArray(createdRows) || createdRows.length === 0) {
    throw createHttpError(502, "Stock adjustment was not returned by Supabase");
  }

  return createdRows[0];
};

export const approveStockAdjustmentRest = async ({
  adjustmentId,
  managerName,
  requestHeaders,
}) => {
  ensureRestConfig();

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/rpc/approve_stock_adjustment`, {
      method: "POST",
      headers: getSupabaseHeaders(requestHeaders),
      body: JSON.stringify({
        p_adjustment_id: adjustmentId,
        p_manager_name: managerName,
      }),
    }),
  );

  return { approved: true };
};

export const rejectStockAdjustmentRest = async ({
  adjustmentId,
  managerName,
  note,
  requestHeaders,
}) => {
  ensureRestConfig();

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/rpc/reject_stock_adjustment`, {
      method: "POST",
      headers: getSupabaseHeaders(requestHeaders),
      body: JSON.stringify({
        p_adjustment_id: adjustmentId,
        p_manager_name: managerName,
        p_rejection_note: note,
      }),
    }),
  );

  return { rejected: true };
};
