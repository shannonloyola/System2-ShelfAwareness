import { createHttpError } from "./http.js";

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNullableString = (value) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const normalizeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const assertRecord = (value, fieldName) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  return value;
};

export const validateDraftPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const headerPayload = assertRecord(body.headerPayload, "headerPayload");

  if (!Array.isArray(body.linePayload) || body.linePayload.length === 0) {
    throw createHttpError(400, "linePayload must contain at least one item");
  }

  return {
    headerPayload,
    linePayload: body.linePayload,
  };
};

export const validatePostPayload = (payload) => ({
  postedBy: normalizeNullableString(payload?.postedBy) ?? "warehouse_operator",
});

export const validateQualityCheckPayload = (payload) => {
  const body = assertRecord(payload, "request body");

  const grn_id = normalizeNullableString(body.grn_id);
  if (!grn_id) {
    throw createHttpError(400, "grn_id is required");
  }

  return {
    grn_id,
    checks: assertRecord(body.checks, "checks"),
    discrepancies: assertRecord(body.discrepancies, "discrepancies"),
    notes: normalizeNullableString(body.notes),
    photo_url: normalizeNullableString(body.photo_url),
  };
};

export const validateDeliverySchedulePayload = (payload) => {
  const body = assertRecord(payload, "request body");

  const delivery_datetime = normalizeNullableString(body.delivery_datetime);
  const supplier_name = normalizeNullableString(body.supplier_name);
  const expected_items_count = normalizeInteger(body.expected_items_count, 0);
  const warehouse_location = normalizeNullableString(body.warehouse_location);

  if (
    !delivery_datetime ||
    !supplier_name ||
    !warehouse_location ||
    expected_items_count <= 0
  ) {
    throw createHttpError(
      400,
      "delivery_datetime, supplier_name, expected_items_count, and warehouse_location are required",
    );
  }

  return {
    delivery_datetime,
    supplier_name,
    expected_items_count,
    warehouse_location,
    contact_person_name: normalizeNullableString(body.contact_person_name),
    contact_phone: normalizeNullableString(body.contact_phone),
    notes: normalizeNullableString(body.notes),
  };
};
