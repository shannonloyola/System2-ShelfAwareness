import { createHttpError } from "./http.js";

const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

const VALID_REASON_CATEGORIES = new Set([
  "Damaged Goods",
  "Count Correction",
  "Theft/Loss",
  "Expiry Write-off",
  "System Error",
  "Other",
]);

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNullableString = (value) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const normalizeNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createHttpError(400, `${fieldName} must be a valid number`);
  }
  return parsed;
};

const assertRecord = (value, fieldName) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  return value;
};

export const validateStatus = (value) => {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return undefined;
  }

  if (!VALID_STATUSES.has(normalized)) {
    throw createHttpError(400, "status must be pending, approved, or rejected");
  }

  return normalized;
};

export const validateAdjustmentPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const product_id = normalizeNumber(body.product_id, "product_id");
  const sku = normalizeNullableString(body.sku);
  const product_name = normalizeNullableString(body.product_name);
  const qty_before = normalizeNumber(body.qty_before, "qty_before");
  const qty_change = normalizeNumber(body.qty_change, "qty_change");
  const reason = normalizeNullableString(body.reason);
  const reason_category = normalizeNullableString(body.reason_category);
  const requested_by = normalizeNullableString(body.requested_by);

  if (!sku || !product_name || !reason || !reason_category || !requested_by) {
    throw createHttpError(
      400,
      "sku, product_name, reason, reason_category, and requested_by are required",
    );
  }

  if (!VALID_REASON_CATEGORIES.has(reason_category)) {
    throw createHttpError(400, "reason_category is invalid");
  }

  return {
    product_id,
    sku,
    product_name,
    qty_before,
    qty_change,
    qty_after: qty_before + qty_change,
    reason,
    reason_category,
    requested_by,
    status: "pending",
    movement_type: "ADJUSTMENT",
  };
};

export const validateApprovalPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const managerName = normalizeNullableString(body.managerName);

  if (!managerName) {
    throw createHttpError(400, "managerName is required");
  }

  return {
    managerName,
  };
};

export const validateRejectionPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const managerName = normalizeNullableString(body.managerName);
  const note = normalizeNullableString(body.note);

  if (!managerName || !note) {
    throw createHttpError(400, "managerName and note are required");
  }

  return {
    managerName,
    note,
  };
};
