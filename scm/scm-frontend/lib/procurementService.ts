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
  duties_paid?: number | null;
  transit_status?: string | null;
  transit_updated_at?: string | null;
  transit_updated_by?: string | null;
  transit_notes?: string | null;
  carrier_name?: string | null;
  carrier_tracking_ref?: string | null;
  freight_mode?: string | null;
  freight_cost?: number | null;
  freight_type?: string | null;
  reserved_at?: string | null;
  expires_at?: string | null;
  item_count?: number | null;
};

export type FreightQuoteRecord = {
  id: string;
  po_id: string;
  po_no: string;
  provider: string;
  freight_type: string;
  cost: number;
  estimated_days: number;
  is_winner: boolean;
  created_at: string | null;
  updated_at: string | null;
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

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !procurementServiceBaseUrl || 
    procurementServiceBaseUrl.trim() === "" ||
    !procurementServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4002";
  }
  return procurementServiceBaseUrl;
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

export const fetchPurchaseOrders = async () => {
  try {
    const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
      `${getBaseUrl()}/purchase-orders?limit=500`,
    );
    return payload.data ?? [];
  } catch (error) {
    console.log("ℹ️ Procurement Service is offline. Using local mock purchase orders.");
    return MOCK_PURCHASE_ORDERS;
  }
};

const MOCK_PURCHASE_ORDERS: PurchaseOrderRecord[] = [
  { po_id: "po-1", po_no: "PO-2026-001", supplier_name: "PharmaCorp Manufacturing", status: "In-Transit", created_at: new Date().toISOString(), expected_delivery_date: new Date(Date.now() + 86400000 * 4).toISOString(), preferred_communication: "Email", item_count: 5 },
  { po_id: "po-2", po_no: "PO-2026-002", supplier_name: "Apex Medical Supplies", status: "Confirmed", created_at: new Date().toISOString(), expected_delivery_date: new Date(Date.now() + 86400000 * 7).toISOString(), preferred_communication: "Portal", item_count: 2 },
  { po_id: "po-3", po_no: "PO-2026-003", supplier_name: "BioCold Solutions", status: "Delivered", created_at: new Date().toISOString(), expected_delivery_date: new Date(Date.now() - 86400000 * 1).toISOString(), preferred_communication: "Phone", item_count: 3 },
];

const MOCK_EXPIRING_RESERVATIONS: PurchaseOrderRecord[] = [
  {
    po_id: "po-res-1",
    po_no: "PO-2026-014",
    supplier_name: "Apex Medical Supplies",
    status: "Reserved",
    created_at: new Date().toISOString(),
    expected_delivery_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    preferred_communication: "Portal",
    reserved_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  },
];

const MOCK_EXPIRED_RESERVATIONS: PurchaseOrderRecord[] = [
  {
    po_id: "po-res-2",
    po_no: "PO-2026-011",
    supplier_name: "BioCold Solutions",
    status: "Released",
    created_at: new Date().toISOString(),
    expected_delivery_date: new Date(Date.now() - 86400000).toISOString(),
    preferred_communication: "Email",
    reserved_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

const buildMockNextPONumber = () => {
  const currentYear = new Date().getFullYear();
  const nextSequence =
    MOCK_PURCHASE_ORDERS.reduce((max, po) => {
      const match = po.po_no?.match(/PO-(\d{4})-(\d+)/i);
      if (!match) return max;
      const [, year, sequence] = match;
      if (Number(year) !== currentYear) return max;
      return Math.max(max, Number(sequence));
    }, 0) + 1;

  return `PO-${currentYear}-${String(nextSequence).padStart(3, "0")}`;
};

export const fetchPurchaseOrderById = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}`,
  );
  return payload.data;
};

export const fetchPurchaseOrderItems = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderItemRecord[] }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/items`,
  );
  return payload.data ?? [];
};

export const fetchPurchaseOrderStatusHistory = async (poId: string) => {
  const payload = await fetchJson<{ data: PurchaseOrderStatusHistoryRecord[] }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/history`,
  );
  return payload.data ?? [];
};

export const fetchNextPurchaseOrderNumber = async () => {
  try {
    const payload = await fetchJson<{ data: { po_no: string } }>(
      `${getBaseUrl()}/purchase-orders/next-number`,
    );
    return payload.data.po_no;
  } catch (error) {
    console.log("Procurement service is offline. Using local mock P.O. number.");
    return buildMockNextPONumber();
  }
};

export const createPurchaseOrder = async (
  payload: PurchaseOrderPayload,
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${getBaseUrl()}/purchase-orders`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/status`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/approval`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/eta`,
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

export const fetchFreightQuotes = async (poId: string) => {
  const payload = await fetchJson<{ data: FreightQuoteRecord[] }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/freight-quotes`,
  );
  return payload.data ?? [];
};

export const createFreightQuote = async (
  poId: string,
  payload: {
    provider: string;
    freightType: string;
    cost: number;
    days: number;
  },
) => {
  const response = await fetchJson<{ data: FreightQuoteRecord }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/freight-quotes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: payload.provider,
        freight_type: payload.freightType,
        cost: payload.cost,
        estimated_days: payload.days,
      }),
    },
  );
  return response.data;
};

export const selectWinnerFreightQuote = async (
  poId: string,
  quoteId: string,
) => {
  const response = await fetchJson<{ data: FreightQuoteRecord }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/freight-quotes/${encodeURIComponent(quoteId)}/winner`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

export const updatePurchaseOrderTransitStatus = async (
  poId: string,
  payload: {
    transit_status: string;
    transit_updated_by?: string | null;
    transit_notes?: string | null;
    carrier_name?: string | null;
    carrier_tracking_ref?: string | null;
    customs_entry_date?: string | null;
    customs_release_date?: string | null;
    duties_paid?: boolean | number | null;
  },
) => {
  const response = await fetchJson<{ data: PurchaseOrderRecord }>(
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/transit-status`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/history/latest-document`,
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
    `${getBaseUrl()}/purchase-orders/import`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/items`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/items/${encodeURIComponent(poItemId)}`,
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
    `${getBaseUrl()}/purchase-orders/${encodeURIComponent(poId)}/items/${encodeURIComponent(poItemId)}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const fetchExpiringReservations = async () => {
  try {
    const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
      `${getBaseUrl()}/purchase-orders/reservations/expiring-soon`,
    );
    return payload.data ?? [];
  } catch (error) {
    console.log("Procurement reservation service is offline. Using local mock expiring reservations.");
    return MOCK_EXPIRING_RESERVATIONS;
  }
};

export const fetchExpiredReservations = async () => {
  try {
    const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
      `${getBaseUrl()}/purchase-orders/reservations/expired`,
    );
    return payload.data ?? [];
  } catch (error) {
    console.log("Procurement reservation service is offline. Using local mock expired reservations.");
    return MOCK_EXPIRED_RESERVATIONS;
  }
};

export const runReservationExpiration = async () => {
  const payload = await fetchJson<{ data: any[] }>(
    `${getBaseUrl()}/purchase-orders/reservations/expire`,
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
  try {
    const payload = await fetchJson<{
      data: {
        allocated_amount?: number | null;
        spent_amount?: number | null;
        month?: number | null;
        year?: number | null;
      } | null;
    }>(`${getBaseUrl()}/purchase-orders/dashboard/monthly-budget/current`);
    return payload.data;
  } catch (error) {
    console.log("ℹ️ Procurement Service is offline. Using local mock monthly budget.");
    return {
      allocated_amount: 1200000,
      spent_amount: 890000,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    };
  }
};

export const fetchCustomsDelays = async () => {
  try {
    const payload = await fetchJson<{ data: PurchaseOrderRecord[] }>(
      `${getBaseUrl()}/purchase-orders/dashboard/customs-delays`,
    );
    return payload.data ?? [];
  } catch (error) {
    console.log("ℹ️ Procurement Service is offline. Using local mock customs delays.");
    return [
      { po_id: "po-1", po_no: "PO-2026-001", supplier_name: "PharmaCorp Manufacturing", status: "In-Transit", created_at: new Date().toISOString(), expected_delivery_date: new Date(Date.now() + 86400000 * 4).toISOString(), preferred_communication: "Email", is_late: true }
    ];
  }
};
