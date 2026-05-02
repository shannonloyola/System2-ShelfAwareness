import { createHttpError } from "./http.js";

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

export const validateLimit = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createHttpError(400, "limit must be a positive integer");
  }

  return parsed;
};

export const validateCycleCountPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const product_id = normalizeNullableString(body.product_id);
  const sku = normalizeNullableString(body.sku);
  const product_name = normalizeNullableString(body.product_name);
  const counted_by = normalizeNullableString(body.counted_by);
  const created_by = normalizeNullableString(body.created_by);
  const import_source = normalizeNullableString(body.import_source);
  const physical_count = normalizeNumber(body.physical_count, "physical_count");

  if (!product_id || !sku || !product_name || !counted_by) {
    throw createHttpError(
      400,
      "product_id, sku, product_name, counted_by, and physical_count are required",
    );
  }

  if (physical_count < 0) {
    throw createHttpError(400, "physical_count cannot be negative");
  }

  return {
    product_id,
    sku,
    product_name,
    physical_count,
    counted_by,
    created_by,
    import_source,
  };
};

export const validateBulkCycleCountPayload = (payload) => {
  const body = assertRecord(payload, "request body");
  const counted_by = normalizeNullableString(body.counted_by);
  const created_by = normalizeNullableString(body.created_by);
  const import_source = normalizeNullableString(body.import_source) ?? "csv_import";

  if (!counted_by) {
    throw createHttpError(400, "counted_by is required");
  }

  if (!Array.isArray(body.counts) || body.counts.length === 0) {
    throw createHttpError(400, "counts must contain at least one item");
  }

  return {
    counted_by,
    created_by,
    import_source,
    counts: body.counts.map((row, index) => {
      const item = assertRecord(row, `counts[${index}]`);
      const sku = normalizeNullableString(item.sku);
      const qty = normalizeNumber(item.qty, `counts[${index}].qty`);

      if (!sku) {
        throw createHttpError(400, `counts[${index}].sku is required`);
      }

      if (qty < 0) {
        throw createHttpError(400, `counts[${index}].qty cannot be negative`);
      }

      return {
        sku,
        qty,
      };
    }),
  };
};
