import { env } from "../config/env.js";

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
  throw new Error(body || `Supabase request failed with ${response.status}`);
};

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/grn_quality_checks?select=grn_id&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const saveGrnQualityChecksRest = async (payload) => {
  ensureRestConfig();

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/grn_quality_checks`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    }),
  );

  return {
    grn_id: payload.grn_id,
    saved: true,
  };
};

export const listShipmentDiscrepanciesRest = async ({
  excludeApproved = false,
} = {}) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/shipment_discrepancies`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "created_at.desc");

  if (excludeApproved) {
    url.searchParams.set("status", "not.in.(approved,resolved,rejected)");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const updateShipmentDiscrepancyRest = async (id, payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/shipment_discrepancies?id=eq.${id}`,
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

export const listQualityChecksRest = async () => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/grn_quality_checks`);
  url.searchParams.set("select", "*");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const resolveDiscrepancyRest = async (id, disposition, resolvedBy = "qc_inspector") => {
  ensureRestConfig();

  const payload = await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/rpc/resolve_discrepancy`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        p_discrepancy_id: id,
        p_disposition: disposition,
        p_resolved_by: resolvedBy,
      }),
    }),
  );

  if (payload?.success === false) {
    throw new Error(payload.error ?? "resolve_discrepancy returned success: false");
  }

  // Fetch the updated row to return it
  const response = await fetch(`${env.supabaseUrl}/rest/v1/shipment_discrepancies?id=eq.${id}`, {
    method: "GET",
    headers: buildHeaders(),
  });
  const data = await handleResponse(response);
  return data[0] ?? null;
};
