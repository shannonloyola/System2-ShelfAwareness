import { env } from "../config/env.js";
import { createHttpError } from "./http.js";
import { calculateSupplierScorecard } from "./scorecards.js";
import {
  getFileCachedScorecard,
  writeAllFileCachedScorecards,
  writeFileCachedScorecard,
} from "./fileCache.js";

const buildHeaders = (extra = {}) => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const currentSourceMonth = () => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
};

const parseResponse = async (response, label) => {
  if (!response.ok) {
    const body = await response.text();
    throw createHttpError(
      response.status,
      body || `Failed to ${label}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const listSuppliersForRecalculation = async () => {
  const url = new URL(`${env.supabaseUrl}/rest/v1/suppliers`);
  url.searchParams.set("select", "supplier_name");
  url.searchParams.set("status", "eq.Active");
  url.searchParams.set("order", "supplier_name.asc");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: buildHeaders(),
  });

  const rows = await parseResponse(
    response,
    "fetch active suppliers",
  );

  return Array.from(
    new Set(
      (rows ?? [])
        .map((row) => String(row.supplier_name || "").trim())
        .filter(Boolean),
    ),
  );
};

export const getCachedScorecard = async (supplierName) => {
  const supplierKey = supplierName.trim().toLowerCase();

  const fileCached = await getFileCachedScorecard(supplierKey);
  if (fileCached) {
    return fileCached;
  }

  const url = new URL(
    `${env.supabaseUrl}/rest/v1/supplier_scorecard_cache`,
  );
  url.searchParams.set("select", "*");
  url.searchParams.set("supplier_name", `ilike.${supplierName}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: buildHeaders(),
  });

  try {
    const rows = await parseResponse(
      response,
      "fetch cached supplier scorecard",
    );

    return rows?.[0] ?? null;
  } catch {
    return null;
  }
};

export const upsertCachedScorecard = async (scorecard) => {
  await writeFileCachedScorecard({
    ...scorecard,
    source_month: currentSourceMonth(),
    computed_at: new Date().toISOString(),
  });

  const payload = {
    ...scorecard,
    source_month: currentSourceMonth(),
    computed_at: new Date().toISOString(),
  };

  const response = await fetch(
    `${env.supabaseUrl}/rest/v1/supplier_scorecard_cache?on_conflict=supplier_key`,
    {
      method: "POST",
      headers: buildHeaders({
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    },
  );

  try {
    const rows = await parseResponse(
      response,
      "upsert cached supplier scorecard",
    );

    return rows?.[0] ?? payload;
  } catch {
    return payload;
  }
};

export const calculateAndCacheSupplierScorecard = async (supplierName) => {
  const scorecard = await calculateSupplierScorecard(supplierName);
  return upsertCachedScorecard(scorecard);
};

export const recalculateAllSupplierScorecards = async () => {
  const supplierNames = await listSuppliersForRecalculation();
  const results = [];

  for (const supplierName of supplierNames) {
    const scorecard =
      await calculateAndCacheSupplierScorecard(supplierName);
    results.push(scorecard);
  }

  await writeAllFileCachedScorecards(results);

  return {
    count: results.length,
    source_month: currentSourceMonth(),
    scorecards: results,
  };
};
