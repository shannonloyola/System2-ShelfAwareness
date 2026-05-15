import { env } from "../config/env.js";

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

const getIdentityKey = () => {
  const projectRef = getProjectRefFromUrl();
  const serviceRoleRef = getProjectRefFromJwt(env.supabaseServiceRoleKey);

  if (projectRef && serviceRoleRef === projectRef) {
    return env.supabaseServiceRoleKey;
  }

  return env.supabaseAnonKey;
};

const canUseServiceRole = () => {
  const projectRef = getProjectRefFromUrl();
  const serviceRoleRef = getProjectRefFromJwt(env.supabaseServiceRoleKey);
  return Boolean(env.supabaseServiceRoleKey && projectRef && serviceRoleRef === projectRef);
};

const buildHeaders = () => ({
  apikey: getIdentityKey(),
  Authorization: `Bearer ${getIdentityKey()}`,
  "Content-Type": "application/json",
});

const buildAnonHeaders = () => ({
  apikey: env.supabaseAnonKey || getIdentityKey(),
  Authorization: `Bearer ${env.supabaseAnonKey || getIdentityKey()}`,
  "Content-Type": "application/json",
});

const buildUserHeaders = (accessToken) => ({
  apikey: env.supabaseAnonKey || getIdentityKey(),
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

const ensureRestConfig = () => {
  if (!env.supabaseUrl || !getIdentityKey()) {
    throw new Error("Identity Supabase REST configuration is not set");
  }
};

const handleResponse = async (response) => {
  if (response.ok) {
    return response.status === 204 ? null : response.json();
  }

  const body = await response.text();
  throw new Error(body || `Supabase REST request failed with ${response.status}`);
};

export const restHealthCheck = async () => {
  ensureRestConfig();

  const response = await fetch(`${env.supabaseUrl}/auth/v1/settings`, {
    method: "GET",
    headers: buildAnonHeaders(),
  }).catch(() => ({ ok: false, status: 500 }));

  if (!response.ok) {
    throw new Error(`Supabase auth health check failed with ${response.status}`);
  }
};

export const getProfileByIdRest = async (userId) => {
  ensureRestConfig();

  const url = new URL(`${env.supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id,full_name,role");
  url.searchParams.set("id", `eq.${userId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }

  const data = await handleResponse(response);
  return Array.isArray(data) ? (data[0] ?? null) : null;
};

export const getCurrentAuthUser = async (accessToken) => {
  ensureRestConfig();

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: buildUserHeaders(accessToken),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }

  return handleResponse(response);
};

export const getMyProfileRest = async (accessToken, userId) => {
  ensureRestConfig();

  if (!accessToken || !userId) {
    return null;
  }

  const url = new URL(`${env.supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("select", "id,full_name,role");
  url.searchParams.set("id", `eq.${userId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: buildUserHeaders(accessToken),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }

  const data = await handleResponse(response);
  return Array.isArray(data) ? (data[0] ?? null) : null;
};

export const getAuthUserById = async (userId) => {
  ensureRestConfig();

  if (!canUseServiceRole()) {
    return null;
  }

  const response = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "GET",
    headers: buildHeaders(),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }

  const data = await handleResponse(response);
  return data?.user ?? data ?? null;
};
