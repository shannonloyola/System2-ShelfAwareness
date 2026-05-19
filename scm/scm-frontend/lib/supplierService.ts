import { supabaseSCM } from "./supabase";

export type SupplierRecord = {
  id: string;
  supplier_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency_code: string | null;
  lead_time_days: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SupplierScorecard = {
  supplier_key: string;
  supplier_name: string;
  total_pos: number;
  approved_pos: number;
  po_approval_rate: number;
  total_receipts: number;
  clean_receipts: number;
  clean_receipt_rate: number;
  total_discrepancies: number;
  approved_discrepancies: number;
  rejected_discrepancies: number;
  avg_discrepancy_units: number;
  reliability_score: number;
  on_time_delivery_pct?: number | null;
  defect_rate?: number | null;
  risk_level?: string | null;
  risk_summary?: string | null;
};

export type CreateSupplierPayload = {
  supplier_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  currency_code: string;
  lead_time_days?: number | null;
  status?: string;
};

const supplierServiceBaseUrl =
  process.env.NEXT_PUBLIC_SUPPLIER_SERVICE_URL ||
  process.env.VITE_SUPPLIER_SERVICE_URL ||
  "http://localhost:4001";

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !supplierServiceBaseUrl || 
    supplierServiceBaseUrl.trim() === "" ||
    !supplierServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4001";
  }
  return supplierServiceBaseUrl;
};


const parseError = async (response: Response) => {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as {
      error?: string;
      details?: string | null;
    };
    return json.error || json.details || text;
  } catch {
    return text || `Request failed with status ${response.status}`;
  }
};

const shouldBypassFetch = () => {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("USE_REAL_SERVICES") !== "true";
  }
  return true;
};

export const fetchSuppliers = async (search = "") => {
  if (shouldBypassFetch()) {
    console.log("ℹ️ Supplier Service is offline. Using direct Supabase fallback.");
    let query = supabaseSCM.from("suppliers").select("*").eq("status", "Active");
    if (search.trim()) {
      query = query.ilike("supplier_name", `%${search.trim()}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  try {
    const url = new URL(`${getBaseUrl()}/suppliers`);
    if (search.trim()) {
      url.searchParams.set("search", search.trim());
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const payload = (await response.json()) as { data: SupplierRecord[] };
    return payload.data;
  } catch (error: any) {
    console.log("ℹ️ Supplier Service is offline. Using direct Supabase fallback.");
    let query = supabaseSCM.from("suppliers").select("*").eq("status", "Active");
    if (search.trim()) {
      query = query.ilike("supplier_name", `%${search.trim()}%`);
    }
    const { data, error: dbError } = await query;
    if (dbError) throw new Error(dbError.message);
    return data || [];
  }
};

export const fetchSupplierScorecard = async (
  supplierName: string,
) => {
  const normalized = supplierName.trim();
  if (!normalized) return null;

  if (shouldBypassFetch()) {
    return null; // Simplified fallback since scorecard is complex
  }

  try {
    const url = new URL(`${getBaseUrl()}/supplier-scorecards`);
    url.searchParams.set("supplier_name", normalized);

    const response = await fetch(url.toString());
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await parseError(response));

    const payload = (await response.json()) as { data: SupplierScorecard | null };
    return payload.data;
  } catch {
    return null; // Fallback gracefully if offline
  }
};

export const fetchSupplierByName = async (
  supplierName: string,
) => {
  const normalized = supplierName.trim();
  if (!normalized) return null;

  if (shouldBypassFetch()) {
    const { data, error } = await supabaseSCM
      .from("suppliers")
      .select("*")
      .ilike("supplier_name", normalized)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    const url = new URL(`${getBaseUrl()}/suppliers/lookup`);
    url.searchParams.set("name", normalized);

    const response = await fetch(url.toString());
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await parseError(response));

    const payload = (await response.json()) as { data: SupplierRecord | null };
    return payload.data;
  } catch (error: any) {
    const { data, error: dbError } = await supabaseSCM
      .from("suppliers")
      .select("*")
      .ilike("supplier_name", normalized)
      .limit(1)
      .maybeSingle();
    if (dbError) throw new Error(dbError.message);
    return data;
  }
};

export const createSupplier = async (
  payload: CreateSupplierPayload,
) => {
  if (shouldBypassFetch()) {
    const { data, error } = await supabaseSCM
      .from("suppliers")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(await parseError(response));

    const parsed = (await response.json()) as { data: SupplierRecord };
    return parsed.data;
  } catch (error: any) {
    const { data, dbError } = await supabaseSCM
      .from("suppliers")
      .insert(payload)
      .select()
      .single() as any;
    if (dbError) throw new Error(dbError.message);
    return data;
  }
};
