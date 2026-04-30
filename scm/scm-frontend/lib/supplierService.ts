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
  lead_time_days: number;
  status?: string;
};

const supplierServiceBaseUrl =
  process.env.NEXT_PUBLIC_SUPPLIER_SERVICE_URL ||
  process.env.VITE_SUPPLIER_SERVICE_URL ||
  "http://localhost:4001";

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

export const fetchSuppliers = async (search = "") => {
  const url = new URL(`${supplierServiceBaseUrl}/suppliers`);

  if (search.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as {
    data: SupplierRecord[];
  };

  return payload.data;
};

export const fetchSupplierScorecard = async (
  supplierName: string,
) => {
  const normalized = supplierName.trim();
  if (!normalized) return null;

  const url = new URL(
    `${supplierServiceBaseUrl}/supplier-scorecards`,
  );
  url.searchParams.set("supplier_name", normalized);

  const response = await fetch(url.toString());
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as {
    data: SupplierScorecard | null;
  };

  return payload.data;
};

export const fetchSupplierByName = async (
  supplierName: string,
) => {
  const normalized = supplierName.trim();
  if (!normalized) {
    return null;
  }

  const url = new URL(
    `${supplierServiceBaseUrl}/suppliers/lookup`,
  );
  url.searchParams.set("name", normalized);

  const response = await fetch(url.toString());
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const payload = (await response.json()) as {
    data: SupplierRecord | null;
  };

  return payload.data;
};

export const createSupplier = async (
  payload: CreateSupplierPayload,
) => {
  const response = await fetch(
    `${supplierServiceBaseUrl}/suppliers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const parsed = (await response.json()) as {
    data: SupplierRecord;
  };

  return parsed.data;
};
