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
    `${env.supabaseUrl}/rest/v1/grn_drafts?select=id&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const saveGrnDraftRest = async ({ headerPayload, linePayload }) => {
  ensureRestConfig();

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/grn_drafts`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(headerPayload),
    }),
  );

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/grn_draft_lines`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(linePayload),
    }),
  );

  return {
    grn_id: headerPayload.id ?? null,
    grn_number: headerPayload.grn_number ?? null,
    lines_saved: linePayload.length,
    status: headerPayload.status ?? "draft",
  };
};

export const postGrnDraftRest = async ({ grnDraftId, postedBy }) => {
  ensureRestConfig();

  const payload = await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/rpc/post_grn_draft`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        p_grn_draft_id: grnDraftId,
        p_posted_by: postedBy,
      }),
    }),
  );

  if (payload?.success === false) {
    throw new Error(payload.error ?? "post_grn_draft returned success: false");
  }

  return payload;
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

export const scheduleDeliveryRest = async (payload) => {
  ensureRestConfig();

  return handleResponse(
    await fetch(`${env.supabaseUrl}/functions/v1/shipments`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }),
  );
};
