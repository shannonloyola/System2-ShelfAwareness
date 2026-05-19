export type DistributionOrderLineRecord = {
  line_uuid: string;
  sku: string;
  qty: number;
  unit_price: number;
  line_total: number;
  qty_fulfilled: number;
  qty_backordered: number;
};

export type DistributionOrderRecord = {
  order_uuid: string;
  order_no: string | null;
  retailer_name: string;
  status: "placed" | "cancelled" | "fulfilled" | "partially_fulfilled";
  total_amount: number;
  payment_terms: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string | null;
  priority_level: string | null;
  retail_order_lines: DistributionOrderLineRecord[];
};

export type DistributionPaymentRecord = {
  id: string;
  supplier_name: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
};

export type DistributionInvoiceSummary = {
  orderTotal: number;
  amountPaid: number;
  remainingBalance: number;
  payments: DistributionPaymentRecord[];
};

export type DistributionAvailableProductRecord = {
  product_id: string;
  sku: string;
  product_name: string;
  current_stock: number;
  selling_price: number;
  cost_price: number;
};

const distributionServiceBaseUrl =
  process.env.NEXT_PUBLIC_DISTRIBUTION_SERVICE_URL ||
  process.env.VITE_DISTRIBUTION_SERVICE_URL ||
  "http://localhost:4006";

// Add a robust fallback in case the env var was set to an empty string, a relative path, or just a port
const getBaseUrl = () => {
  if (
    !distributionServiceBaseUrl || 
    distributionServiceBaseUrl.trim() === "" ||
    !distributionServiceBaseUrl.startsWith("http")
  ) {
    return "http://localhost:4006";
  }
  return distributionServiceBaseUrl;
};


const parseError = async (response: Response) => {
  const text = await response.text();

  try {
    const json = JSON.parse(text) as {
      error?: string;
      details?: string | null;
      message?: string;
    };
    return json.error || json.details || json.message || text;
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

export const fetchDistributionOrders = async () => {
  try {
    const payload = await fetchJson<{ data: DistributionOrderRecord[] }>(
      `${getBaseUrl()}/orders`,
    );
    return payload.data ?? [];
  } catch (error) {
    console.error("Distribution orders unavailable.", error);
    return [];
  }
};

export const fetchDistributionInventoryValueTotal = async () => {
  try {
    const payload = await fetchJson<{
      data: { total_inventory_value_php: number | null };
    }>(`${getBaseUrl()}/inventory-value/total`);
    return payload.data?.total_inventory_value_php ?? null;
  } catch (error) {
    console.error("Distribution inventory value unavailable.", error);
    return null;
  }
};

export const fetchDistributionInventoryValueByCategory = async () => {
  try {
    const payload = await fetchJson<{
      data: Array<{ category_name: string; total_value_php: number }>;
    }>(`${getBaseUrl()}/inventory-value/by-category`);
    return payload.data ?? [];
  } catch (error) {
    console.error("Distribution inventory value by category unavailable.", error);
    return [];
  }
};

export const fetchDistributionAvailableProducts = async () => {
  const payload = await fetchJson<{
    data: DistributionAvailableProductRecord[];
  }>(`${getBaseUrl()}/products/availability`);
  return payload.data ?? [];
};

export const updateDistributionOrderLines = async (
  orderId: string,
  lines: Array<{ sku: string; qty: number }>,
) => {
  const payload = await fetchJson<{ data: { updated: boolean } }>(
    `${getBaseUrl()}/orders/${encodeURIComponent(orderId)}/lines`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ lines }),
    },
  );
  return payload.data;
};

export const cancelDistributionOrder = async (
  orderId: string,
  reason: string,
) => {
  const payload = await fetchJson<{ data: { success?: boolean; error?: string } }>(
    `${getBaseUrl()}/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    },
  );
  return payload.data;
};

export const fetchDistributionInvoiceSummary = async (params: {
  orderId: string;
  retailerName: string;
  orderNo: string;
  orderTotal: number;
}) => {
  const url = new URL(
    `${getBaseUrl()}/orders/${encodeURIComponent(params.orderId)}/payments`,
  );
  url.searchParams.set("retailer_name", params.retailerName);
  url.searchParams.set("order_no", params.orderNo);
  url.searchParams.set("order_total", String(params.orderTotal));

  const payload = await fetchJson<{ data: DistributionInvoiceSummary }>(
    url.toString(),
  );
  return payload.data;
};

export const createDistributionPayment = async (payload: {
  supplier_name: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_no: string;
  notes: string;
}) => {
  const response = await fetchJson<{ data: { saved: boolean } }>(
    `${getBaseUrl()}/payments`,
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

export const createDistributionOrder = async (payload: {
  retailer_name: string;
  branch_suffix?: string | null;
  payment_terms?: string | null;
  due_date?: string | null;
  notes?: string | null;
  priority_level?: string | null;
  lines: Array<{ sku: string; qty: number }>;
}) => {
  const response = await fetchJson<{
    data: {
      fulfillment?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }>(`${getBaseUrl()}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return response.data;
};

export const downloadDistributionInvoice = async (orderId: string) => {
  const response = await fetch(
    `${getBaseUrl()}/orders/${encodeURIComponent(orderId)}/invoice`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return response.blob();
};
