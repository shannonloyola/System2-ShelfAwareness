export type PostGrnResult = {
  grn_id: string;
  grn_number: string;
  lines_processed: number;
  products_updated: number;
  movements_inserted: number;
  posted_by: string;
  posted_at: string;
  status: "POSTED";
};

const warehouseReceivingServiceBaseUrl =
  process.env.NEXT_PUBLIC_WAREHOUSE_RECEIVING_SERVICE_URL ||
  process.env.VITE_WAREHOUSE_RECEIVING_SERVICE_URL ||
  "http://localhost:4005";

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !warehouseReceivingServiceBaseUrl || 
    warehouseReceivingServiceBaseUrl.trim() === "" ||
    !warehouseReceivingServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4005";
  }
  return warehouseReceivingServiceBaseUrl;
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

export const saveGrnDraft = async (
  headerPayload: object,
  linePayload: object[],
) => {
  const payload = await fetchJson<{ data: unknown }>(
    `${getBaseUrl()}/grn-drafts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        headerPayload,
        linePayload,
      }),
    },
  );
  return payload.data;
};

export const postGrnDraft = async (
  grnDraftId: string,
  postedBy = "warehouse_operator",
) => {
  const payload = await fetchJson<{ data: PostGrnResult }>(
    `${getBaseUrl()}/grn-drafts/${encodeURIComponent(grnDraftId)}/post`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ postedBy }),
    },
  );
  return payload.data;
};

export const scheduleWarehouseDelivery = async (payload: {
  delivery_datetime: string;
  supplier_name: string;
  expected_items_count: number;
  warehouse_location: string;
  contact_person_name?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
}) => {
  const response = await fetchJson<{ data: unknown }>(
    `${getBaseUrl()}/delivery-schedules`,
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
