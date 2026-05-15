import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const getProjectRefFromUrl = () => {
  try {
    return new URL(env.supabaseUrl).hostname.split(".")[0];
  } catch {
    return "";
  }
};

const getProjectRefFromJwt = (token) => {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    return payload.ref || "";
  } catch {
    return "";
  }
};

const getRestKey = () => {
  const projectRef = getProjectRefFromUrl();
  const serviceRoleRef = getProjectRefFromJwt(env.supabaseServiceRoleKey);

  if (projectRef && serviceRoleRef === projectRef) {
    return env.supabaseServiceRoleKey;
  }

  return env.supabaseAnonKey;
};

const buildHeaders = () => ({
  apikey: getRestKey(),
  Authorization: `Bearer ${getRestKey()}`,
  "Content-Type": "application/json",
});

const supplierSelect =
  "id,supplier_name,contact_person,email,phone,address,currency_code,lead_time_days,status,created_at";

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !getRestKey()) {
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

  throw new Error(text || `Supabase REST request failed with ${response.status}`);
};

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/suppliers?select=id&limit=1`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase REST health check failed with ${response.status}`);
  }
};

export const listSuppliersRest = async ({ limit, offset, search }) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/suppliers`);
  url.searchParams.set("select", supplierSelect);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order", "supplier_name.asc");

  if (search) {
    url.searchParams.set(
      "or",
      `(supplier_name.ilike.*${search}*,contact_person.ilike.*${search}*,email.ilike.*${search}*)`,
    );
  }

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  return handleResponse(response);
};

export const getSupplierByIdRest = async (supplierId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/suppliers`);
  url.searchParams.set("select", supplierSelect);
  url.searchParams.set("id", `eq.${supplierId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  const data = await handleResponse(response);
  return data[0] ?? null;
};

export const createSupplierRest = async (payload) => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/rest/v1/suppliers`, {
    method: "POST",
    headers: {
      ...buildHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await handleResponse(response);
  return data[0];
};

export const updateSupplierRest = async (supplierId, payload) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/suppliers?id=eq.${supplierId}`,
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
    "Supplier update was not applied. Check Supabase update permissions or RLS policies for the suppliers table.",
  );
};

export const deleteSupplierRest = async (supplierId) => {
  ensureRestConfig();

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/suppliers?id=eq.${supplierId}`,
    {
      method: "DELETE",
      headers: {
        ...buildHeaders(),
        Prefer: "return=representation",
      },
    },
  );

  await handleResponse(response);
  return { id: supplierId };
};
