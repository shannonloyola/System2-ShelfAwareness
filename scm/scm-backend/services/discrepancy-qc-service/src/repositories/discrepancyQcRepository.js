import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";
import {
  listQualityChecksRest,
  listShipmentDiscrepanciesRest,
  saveGrnQualityChecksRest,
  updateShipmentDiscrepancyRest,
  resolveDiscrepancyRest,
} from "../lib/supabaseRest.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for discrepancy-qc-service.",
    );
  }
};

export const saveGrnQualityChecks = async (payload) => {
  requireSupabaseConfig();
  return saveGrnQualityChecksRest(payload);
};

export const listShipmentDiscrepancies = async (options) => {
  requireSupabaseConfig();
  return listShipmentDiscrepanciesRest(options);
};

export const updateShipmentDiscrepancy = async (id, payload) => {
  requireSupabaseConfig();

  let row;
  if (payload.disposition) {
    row = await resolveDiscrepancyRest(id, payload.disposition, payload.resolved_by);
  } else {
    row = await updateShipmentDiscrepancyRest(id, payload);
  }

  if (!row) {
    throw createHttpError(404, "Shipment discrepancy not found");
  }

  return row;
};

export const getQualityReportsSummary = async () => {
  requireSupabaseConfig();

  const [qcRows, discrepancyRows] = await Promise.all([
    listQualityChecksRest(),
    listShipmentDiscrepanciesRest(),
  ]);

  const qcTotals = { pass: 0, fail: 0 };

  qcRows.forEach((row) => {
    const raw =
      row.result ??
      row.status ??
      row.outcome ??
      row.qc_status ??
      row.decision ??
      "";
    const value = String(raw).toLowerCase();

    if (value.includes("pass")) {
      qcTotals.pass += 1;
    }

    if (value.includes("fail") || value.includes("reject")) {
      qcTotals.fail += 1;
    }
  });

  // Include only active discrepancies as quality failures for current monitoring
  qcTotals.fail += discrepancyRows.filter(
    (r) => r.status !== "resolved" && r.status !== "approved",
  ).length;

  const supplierMap = new Map();
  discrepancyRows.forEach((row) => {
    const name =
      row.supplier_name ??
      row.vendor_name ??
      row.supplier ??
      row.vendor ??
      row.reported_by ??
      "Unknown Supplier";
    supplierMap.set(name, (supplierMap.get(name) ?? 0) + 1);
  });

  const supplierDefects = Array.from(supplierMap.entries())
    .map(([name, defects]) => ({ name, defects }))
    .sort((a, b) => b.defects - a.defects)
    .slice(0, 6)
    .map((item, index) => ({
      ...item,
      id: `${item.name}-${index}`,
    }));

  const resolutionCounts = {
    pending: discrepancyRows.filter(r => r.status === 'pending').length,
    in_review: discrepancyRows.filter(r => r.status === 'in_review').length,
    resolved: discrepancyRows.filter(r => r.status === 'resolved').length,
    rejected: discrepancyRows.filter(r => r.status === 'rejected').length,
  };

  return {
    qc_summary: qcTotals,
    supplier_defects: supplierDefects,
    resolution_counts: resolutionCounts,
  };
};
