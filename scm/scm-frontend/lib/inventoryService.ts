export type InventoryItemRecord = {
  id: string;
  productUuid: string | null;
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  reservedStock: number;
  lastUpdated: string | null;
  systemCount: number;
  status: "normal" | "low" | "zero";
};

export type BackorderAlertRecord = {
  id: string;
  sku: string;
  message: string | null;
  grn_reference: string | null;
  pending_backorder_count: number | null;
  created_at: string | null;
};

const inventoryServiceBaseUrl =
  process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL ||
  process.env.VITE_INVENTORY_SERVICE_URL ||
  "http://localhost:4004";

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

export const fetchInventoryItems = async (params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => {
  const url = new URL(`${inventoryServiceBaseUrl}/inventory`);

  if (params?.search?.trim()) {
    url.searchParams.set("search", params.search.trim());
  }
  if (params?.limit != null) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params?.offset != null) {
    url.searchParams.set("offset", String(params.offset));
  }

  const payload = await fetchJson<{ data: InventoryItemRecord[] }>(
    url.toString(),
  );
  return payload.data ?? [];
};

export const receiveInventoryScan = async (payload: {
  product_id?: string | null;
  product_uuid?: string | null;
  reserved_stock?: number;
  increment?: number;
}) => {
  const response = await fetchJson<{ data: InventoryItemRecord }>(
    `${inventoryServiceBaseUrl}/inventory/receive-scan`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const fetchBackorderAlerts = async (limit = 10) => {
  const payload = await fetchJson<{ data: BackorderAlertRecord[] }>(
    `${inventoryServiceBaseUrl}/backorder-alerts?limit=${encodeURIComponent(String(limit))}`,
  );
  return payload.data ?? [];
};
