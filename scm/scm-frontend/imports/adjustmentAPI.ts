export type ReasonCategory =
  | 'Damaged Goods'
  | 'Count Correction'
  | 'Theft/Loss'
  | 'Expiry Write-off'
  | 'System Error'
  | 'Other';

export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';

export interface StockAdjustment {
  id: string;
  product_id: number;
  sku: string;
  product_name: string;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  reason: string;
  reason_category: ReasonCategory;
  status: AdjustmentStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_note: string | null;
  created_at: string;
}

const stockAdjustmentServiceBaseUrl =
  process.env.NEXT_PUBLIC_STOCK_ADJUSTMENT_SERVICE_URL ||
  process.env.VITE_STOCK_ADJUSTMENT_SERVICE_URL ||
  "http://localhost:4008";

const parseError = async (response: Response) => {
  const text = await response.text();
  let combined = text;

  try {
    const json = JSON.parse(text) as {
      error?: string;
      details?: string | null;
    };
    combined = json.error || json.details || text;
  } catch {
    combined = text || `Request failed with status ${response.status}`;
  }

  if (
    combined.toLowerCase().includes("nonnegative") ||
    combined.toLowerCase().includes("negative")
  ) {
    return "Approval would make stock negative. Reduce the deduction or replenish stock first.";
  }

  return combined || "Unexpected service error";
};

export const REASON_CATEGORIES: ReasonCategory[] = [
  'Damaged Goods', 'Count Correction', 'Theft/Loss',
  'Expiry Write-off', 'System Error', 'Other',
];

export async function submitAdjustment(payload: {
  product_id: number; sku: string; product_name: string;
  qty_before: number; qty_change: number; reason: string;
  reason_category: ReasonCategory; requested_by: string;
}) {
  const response = await fetch(
    `${stockAdjustmentServiceBaseUrl}/stock-adjustments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
  const parsed = (await response.json()) as { data: StockAdjustment };
  return parsed.data;
}

export async function approveAdjustment(id: string, managerName: string) {
  const response = await fetch(
    `${stockAdjustmentServiceBaseUrl}/stock-adjustments/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ managerName }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
}

export async function rejectAdjustment(id: string, managerName: string, note: string) {
  const response = await fetch(
    `${stockAdjustmentServiceBaseUrl}/stock-adjustments/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ managerName, note }),
    },
  );
  if (!response.ok) throw new Error(await parseError(response));
}

export async function fetchAdjustments(status?: AdjustmentStatus) {
  const url = new URL(
    `${stockAdjustmentServiceBaseUrl}/stock-adjustments`,
  );
  if (status) {
    url.searchParams.set("status", status);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) throw new Error(await parseError(response));
  const parsed = (await response.json()) as {
    data: StockAdjustment[];
  };
  return parsed.data ?? [];
}
