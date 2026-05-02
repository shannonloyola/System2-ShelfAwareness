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

/**
 * Fetch a single shipment by tracking number from the `shipments` table.
 */
export const getShipmentByTracking = async (trackingNumber) => {
  ensureRestConfig();

  const url = `${env.supabaseUrl}/rest/v1/shipments?tracking_number=eq.${encodeURIComponent(trackingNumber)}&limit=1`;
  const results = await handleResponse(
    await fetch(url, { method: "GET", headers: buildHeaders() }),
  );

  return Array.isArray(results) && results.length > 0 ? results[0] : null;
};

/**
 * Fetch all shipments with status 'pending'.
 */
export const getPendingShipments = async () => {
  ensureRestConfig();

  const url = `${env.supabaseUrl}/rest/v1/shipments?status=eq.pending&order=expected_arrival.asc`;
  const results = await handleResponse(
    await fetch(url, { method: "GET", headers: buildHeaders() }),
  );

  return Array.isArray(results) ? results : [];
};

/**
 * Count shipments received today.
 */
export const getTodayReceivedCount = async () => {
  ensureRestConfig();

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const url = `${env.supabaseUrl}/rest/v1/shipments?status=eq.received&received_at=gte.${today}T00:00:00&received_at=lte.${today}T23:59:59&select=id`;

  const results = await handleResponse(
    await fetch(url, {
      method: "GET",
      headers: { ...buildHeaders(), Prefer: "count=exact" },
    }),
  );

  return Array.isArray(results) ? results.length : 0;
};

/**
 * PATCH a shipment's status (e.g., mark as 'received').
 */
export const updateShipmentStatus = async ({ id, status, receivedBy, notes }) => {
  ensureRestConfig();

  const patchPayload = {
    status,
    ...(receivedBy && { received_by: receivedBy }),
    ...(notes && { notes }),
    ...(status === "received" && { received_at: new Date().toISOString() }),
  };

  await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/shipments?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        ...buildHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patchPayload),
    }),
  );

  // Return the updated record
  const updated = await handleResponse(
    await fetch(`${env.supabaseUrl}/rest/v1/shipments?id=eq.${id}&limit=1`, {
      method: "GET",
      headers: buildHeaders(),
    }),
  );

  return Array.isArray(updated) && updated.length > 0 ? updated[0] : { id, status };
};
