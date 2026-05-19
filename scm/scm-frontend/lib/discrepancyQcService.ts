export type ShipmentDiscrepancyRecord = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  shipment_id?: string | null;
  shipment_reference?: string | null;
  po_number?: string | null;
  sku?: string | null;
  product_name?: string | null;
  expected_qty?: number | null;
  received_qty?: number | null;
  discrepancy_reason?: string | null;
  notes?: string | null;
  reported_by?: string | null;
  image_urls?: string[] | string | null;
  disposition?: "released" | "returned" | "scrapped" | null;
  [key: string]: unknown;
};

const discrepancyQcServiceBaseUrl =
  process.env.NEXT_PUBLIC_DISCREPANCY_QC_SERVICE_URL ||
  process.env.VITE_DISCREPANCY_QC_SERVICE_URL ||
  "http://localhost:4007";

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !discrepancyQcServiceBaseUrl || 
    discrepancyQcServiceBaseUrl.trim() === "" ||
    !discrepancyQcServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4007";
  }
  return discrepancyQcServiceBaseUrl;
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

const fetchJson = async <T>(input: string, init?: RequestInit) => {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
};

export const fetchShipmentDiscrepancies = async (options?: {
  excludeApproved?: boolean;
}) => {
  const url = new URL(`${getBaseUrl()}/shipment-discrepancies`);

  if (options?.excludeApproved) {
    url.searchParams.set("excludeApproved", "true");
  }

  const payload = await fetchJson<{ data: ShipmentDiscrepancyRecord[] }>(
    url.toString(),
  );
  return payload.data ?? [];
};

export const updateShipmentDiscrepancyDisposition = async (
  id: string,
  disposition: "released" | "returned" | "scrapped",
) => {
  const payload = await fetchJson<{ data: ShipmentDiscrepancyRecord }>(
    `${getBaseUrl()}/shipment-discrepancies/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disposition }),
    },
  );
  return payload.data;
};

export const fetchDiscrepancyReportsSummary = async () => {
  const payload = await fetchJson<{
    data: {
      qc_summary: { pass: number; fail: number };
      supplier_defects: Array<{
        name: string;
        defects: number;
        id: string;
      }>;
      resolution_counts?: {
        pending: number;
        in_review: number;
        resolved: number;
        rejected: number;
      };
    };
  }>(`${getBaseUrl()}/shipment-discrepancies/reports/summary`);
  return payload.data;
};
