import { env } from "../config/env.js";

const buildHeaders = () => {
  const key = env.fulfillmentSupabaseServiceRoleKey || env.fulfillmentSupabaseAnonKey;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
};

const ensureRestConfig = () => {
  if (!env.fulfillmentSupabaseUrl || (!env.fulfillmentSupabaseAnonKey && !env.fulfillmentSupabaseServiceRoleKey)) {
    throw new Error("SUPABASE_FULFILLMENT_URL and at least one API KEY must be set");
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
    `${env.fulfillmentSupabaseUrl}/rest/v1/grn_drafts?select=id&limit=1`,
    {
      method: "GET",
      headers: buildHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

const resolveProductUuids = async (linePayload) => {
  const needsResolution = linePayload.filter(line => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(line.product_id)));
  
  if (needsResolution.length === 0) return linePayload;

  const productIds = [...new Set(needsResolution.map(l => l.product_id))];
  const query = `product_id=in.(${productIds.join(",")})`;
  
  const response = await fetch(`${env.scmSupabaseUrl}/rest/v1/products?select=product_id,product_uuid&${query}`, {
    headers: {
      apikey: env.scmSupabaseAnonKey,
      Authorization: `Bearer ${env.scmSupabaseAnonKey}`
    }
  });

  if (!response.ok) return linePayload;

  const products = await response.json();
  const uuidMap = new Map(products.map(p => [String(p.product_id), p.product_uuid]));

  return linePayload.map(line => ({
    ...line,
    product_id: uuidMap.get(String(line.product_id)) || line.product_id
  }));
};

export const saveGrnDraftRest = async ({ headerPayload, linePayload }) => {
  ensureRestConfig();

  const resolvedLinePayload = await resolveProductUuids(linePayload);

  await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/grn_drafts`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(headerPayload),
    }),
  );

  await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/grn_draft_lines`, {
      method: "POST",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(resolvedLinePayload),
    }),
  );

  return {
    grn_id: headerPayload.id ?? null,
    grn_number: headerPayload.grn_number ?? null,
    lines_saved: resolvedLinePayload.length,
    status: headerPayload.status ?? "draft",
  };
};

export const postGrnDraftRest = async ({ grnDraftId, postedBy }) => {
  ensureRestConfig();

  const payload = await handleResponse(
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/rpc/post_grn_draft`, {
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
    await fetch(`${env.fulfillmentSupabaseUrl}/rest/v1/grn_quality_checks`, {
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
    await fetch(`${env.fulfillmentSupabaseUrl}/functions/v1/shipments`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(payload),
    }),
  );
};
