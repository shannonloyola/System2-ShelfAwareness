import { env } from "../config/env.js";
import { createHttpError } from "./http.js";

const buildHeaders = () => ({
  apikey: env.supabaseAnonKey,
  Authorization: `Bearer ${env.supabaseAnonKey}`,
});

const round = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const clamp = (value, min, max) =>
  Math.min(Math.max(value, min), max);

const normalizeSupplierKey = (supplierName) =>
  supplierName.trim().toLowerCase();

const parseRows = async (response, label) => {
  if (!response.ok) {
    const body = await response.text();
    throw createHttpError(
      response.status,
      body || `Failed to fetch ${label}`,
    );
  }

  return response.json();
};

const fetchPurchaseOrders = async (supplierName) => {
  const url = new URL(`${env.supabaseUrl}/rest/v1/purchase_orders`);
  url.searchParams.set(
    "select",
    "po_id,supplier_name,status,approval_status,is_late,expected_delivery_date,created_at,paid_at",
  );
  url.searchParams.set("supplier_name", `ilike.${supplierName}`);
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: buildHeaders(),
  });

  return parseRows(response, "purchase orders");
};

const fetchDiscrepancies = async (supplierName) => {
  const url = new URL(
    `${env.supabaseUrl}/rest/v1/shipment_discrepancies`,
  );
  url.searchParams.set(
    "select",
    "id,supplier_name,status,discrepancy_units,reported_at",
  );
  url.searchParams.set("supplier_name", `ilike.${supplierName}`);
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: buildHeaders(),
  });

  return parseRows(response, "shipment discrepancies");
};

const computeRisk = ({
  reliabilityScore,
  onTimeDeliveryPct,
  defectRate,
}) => {
  if (
    reliabilityScore >= 85 &&
    onTimeDeliveryPct >= 95 &&
    defectRate <= 5
  ) {
    return {
      risk_level: "low",
      risk_summary: "Supplier looks healthy",
    };
  }

  if (
    reliabilityScore >= 70 &&
    onTimeDeliveryPct >= 85 &&
    defectRate <= 10
  ) {
    return {
      risk_level: "medium",
      risk_summary: "Monitor supplier performance",
    };
  }

  return {
    risk_level: "high",
    risk_summary: "Warning",
  };
};

export const calculateSupplierScorecard = async (
  supplierName,
) => {
  const normalizedSupplierName = supplierName.trim();
  const [purchaseOrders, discrepancies] = await Promise.all([
    fetchPurchaseOrders(normalizedSupplierName),
    fetchDiscrepancies(normalizedSupplierName),
  ]);

  const totalPos = purchaseOrders.length;
  const approvedPos = purchaseOrders.filter(
    (row) =>
      String(row.approval_status || "").toLowerCase() ===
      "approved",
  ).length;
  const poApprovalRate =
    totalPos > 0 ? round((approvedPos / totalPos) * 100) : 0;

  const receivedOrders = purchaseOrders.filter(
    (row) =>
      String(row.status || "").toLowerCase() === "received",
  );
  const totalReceipts = receivedOrders.length;
  const onTimeReceipts = receivedOrders.filter(
    (row) => row.is_late === false,
  ).length;
  const onTimeDeliveryPct =
    totalReceipts > 0
      ? round((onTimeReceipts / totalReceipts) * 100)
      : 0;

  const totalDiscrepancies = discrepancies.length;
  const approvedDiscrepancies = discrepancies.filter(
    (row) =>
      String(row.status || "").toLowerCase() === "approved",
  ).length;
  const rejectedDiscrepancies = discrepancies.filter(
    (row) =>
      String(row.status || "").toLowerCase() === "rejected",
  ).length;
  const avgDiscrepancyUnits =
    totalDiscrepancies > 0
      ? round(
          discrepancies.reduce(
            (sum, row) => sum + Number(row.discrepancy_units || 0),
            0,
          ) / totalDiscrepancies,
        )
      : 0;

  const defectRate =
    totalPos > 0
      ? round((totalDiscrepancies / totalPos) * 100)
      : 0;

  // Inference from existing data:
  // reliability heavily emphasizes on-time delivery, with defect rate as the penalty component.
  const reliabilityScore = round(
    clamp(
      onTimeDeliveryPct * 0.7 + (100 - defectRate) * 0.3,
      0,
      100,
    ),
  );

  const risk = computeRisk({
    reliabilityScore,
    onTimeDeliveryPct,
    defectRate,
  });

  return {
    supplier_key: normalizeSupplierKey(normalizedSupplierName),
    supplier_name: normalizedSupplierName,
    total_pos: totalPos,
    approved_pos: approvedPos,
    po_approval_rate: poApprovalRate,
    total_receipts: totalReceipts,
    on_time_receipts: onTimeReceipts,
    on_time_delivery_pct: onTimeDeliveryPct,
    total_discrepancies: totalDiscrepancies,
    approved_discrepancies: approvedDiscrepancies,
    rejected_discrepancies: rejectedDiscrepancies,
    avg_discrepancy_units: avgDiscrepancyUnits,
    defect_rate: defectRate,
    reliability_score: reliabilityScore,
    risk_level: risk.risk_level,
    risk_summary: risk.risk_summary,
  };
};
