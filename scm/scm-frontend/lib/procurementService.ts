export type PurchaseOrderRecord = {
  po_id: string;
  po_no: string | null;
  supplier_name: string | null;
  status: string | null;
  created_at: string | null;
  paid_at?: string | null;
  expected_delivery_date: string | null;
  preferred_communication: string | null;
  approval_status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  is_late?: boolean | null;
  customs_entry_date?: string | null;
  customs_release_date?: string | null;
  transit_status?: string | null;
  reserved_at?: string | null;
  expires_at?: string | null;
  item_count?: number | null;
};

export type PurchaseOrderItemRecord = {
  po_item_id: string;
  po_id: string;
  item_name: string | null;
  quantity: number | null;
};

export type PurchaseOrderStatusHistoryRecord = {
  history_id: string;
  po_id: string;
  status_name: string | null;
  changed_at: string | null;
  document_url?: string | null;
  reason?: string | null;
};

type PurchaseOrderPayload = {
  po_no?: string | null;
  supplier_name?: string | null;
  status?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  expected_delivery_date?: string | null;
  preferred_communication?: string | null;
};

const procurementServiceBaseUrl =
  process.env.NEXT_PUBLIC_PROCUREMENT_SERVICE_URL ||
  process.env.VITE_PROCUREMENT_SERVICE_URL ||
  "http://localhost:4002";

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

export const fetchPurchaseOrders = async () => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders?limit=500`,
  );
  return payload.data ?? [];
};

export const fetchPurchaseOrderById = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}`,
  );
  return payload.data;
};

export const fetchPurchaseOrderItems = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderItemRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/items`,
  );
  return payload.data ?? [];
};

export const fetchPurchaseOrderStatusHistory = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderStatusHistoryRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/history`,
  );
  return payload.data ?? [];
};

export const fetchNextPurchaseOrderNumber = async () => {
  const payload = await fetchJson<{ data: { po_no: string } }>(
    `${procurementServiceBaseUrl}/purchase-orders/next-number`,
  );
  return payload.data.po_no;
};

export const createPurchaseOrder = async (
  payload: PurchaseOrderPayload,
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders`,
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

export const updatePurchaseOrder = async (
  poId: string,
  payload: PurchaseOrderPayload,
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const updatePurchaseOrderStatus = async (
  poId: string,
  status: string,
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );
  return response.data;
};

export const updatePurchaseOrderApproval = async (
  poId: string,
  payload: {
    approval_status: "Approved" | "Rejected" | "Pending";
    approved_by?: string | null;
    rejection_reason?: string | null;
  },
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/approval`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const updatePurchaseOrderEta = async (
  poId: string,
  payload: {
    expected_delivery_date: string;
    reason: string;
  },
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/eta`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const updatePurchaseOrderLatestDocument = async (
  poId: string,
  payload: {
    document_url: string;
    status_name?: string | null;
  },
) => {
  const response = await fetchJson<{ data: PurchaseOrderStatusHistoryRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/history/latest-document`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const importPurchaseOrder = async (payload: {
  po_no: string;
  supplier_name: string;
  expected_delivery_date: string | null;
  preferred_communication: string | null;
  items: Array<{ item_name: string; quantity: number }>;
}) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/import`,
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

export const createPurchaseOrderItem = async (
  poId: string,
  payload: { item_name: string; quantity: number },
) => {
  const response = await fetchJson<{ data: PurchaseOrderItemRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/items`,
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

export const updatePurchaseOrderItem = async (
  poId: string,
  poItemId: string,
  payload: { item_name: string; quantity: number },
) => {
  const response = await fetchJson<{ data: PurchaseOrderItemRecord }>(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/items/${encodeURIComponent(poItemId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
};

export const deletePurchaseOrderItem = async (
  poId: string,
  poItemId: string,
) => {
  return fetchJson(
    `${procurementServiceBaseUrl}/purchase-orders/${encodeURIComponent(poId)}/items/${encodeURIComponent(poItemId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const fetchExpiringReservations = async () => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/reservations/expiring-soon`,
  );
  return payload.data ?? [];
};

export const fetchExpiredReservations = async () => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/reservations/expired`,
  );
  return payload.data ?? [];
};

export const runReservationExpiration = async () => {
  const payload = await fetchJson<{ data: any[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/reservations/expire`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return payload.data ?? [];
};

export const fetchCurrentMonthlyBudget = async () => {
  const payload = await fetchJson<{
    data: {
      allocated_amount?: number | null;
      spent_amount?: number | null;
      month?: number | null;
      year?: number | null;
    } | null;
  }>(`${procurementServiceBaseUrl}/purchase-orders/dashboard/monthly-budget/current`);
  return payload.data;
};

export const fetchCustomsDelays = async () => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
    `${procurementServiceBaseUrl}/purchase-orders/dashboard/customs-delays`,
  );
  return payload.data ?? [];
};
