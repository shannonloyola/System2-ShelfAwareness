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

const normalizeNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? fallback));
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const parsePagination = (query) => {
  const limit = Number.parseInt(query.limit ?? "100", 10);
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const search = normalizeString(query.search);

  return {
    limit: Number.isNaN(limit) ? 100 : Math.min(Math.max(limit, 1), 500),
    offset: Number.isNaN(offset) ? 0 : Math.max(offset, 0),
    search,
  };
};

export const validateProductPayload = (payload, { partial = false } = {}) => {
  const normalized = {
    sku: normalizeNullableString(payload.sku),
    product_name: normalizeNullableString(payload.product_name),
    category_id: normalizeNullableString(payload.category_id),
    category: normalizeNullableString(payload.category),
    unit: normalizeNullableString(payload.unit) ?? "pcs",
    barcode: normalizeNullableString(payload.barcode),
    supplier: normalizeNullableString(payload.supplier),
    warehouse_location: normalizeNullableString(payload.warehouse_location),
    unit_price: normalizeNumber(payload.unit_price, 0),
    cost_price: normalizeNumber(payload.cost_price, 0),
    currency_code: normalizeNullableString(payload.currency_code) ?? "PHP",
    inventory_on_hand: normalizeInteger(payload.inventory_on_hand, 0),
    created_at: normalizeNullableString(payload.created_at),
  };

  if (partial && Object.keys(payload).length === 0) {
    throw createHttpError(400, "At least one field is required for update");
  }

  if (!partial) {
    const required = [
      ["sku", normalized.sku],
      ["product_name", normalized.product_name],
      ["category_id", normalized.category_id],
      ["barcode", normalized.barcode],
      ["supplier", normalized.supplier],
      ["warehouse_location", normalized.warehouse_location],
    ];

    const missing = required
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw createHttpError(
        400,
        `Missing required fields: ${missing.join(", ")}`,
      );
    }
  }

  if (payload.unit_price !== undefined && normalized.unit_price < 0) {
    throw createHttpError(400, "unit_price must be non-negative");
  }

  if (payload.cost_price !== undefined && normalized.cost_price < 0) {
    throw createHttpError(400, "cost_price must be non-negative");
  }

  if (
    payload.inventory_on_hand !== undefined &&
    normalized.inventory_on_hand < 0
  ) {
    throw createHttpError(400, "inventory_on_hand must be non-negative");
  }

  if (partial) {
    return Object.fromEntries(
      Object.entries(normalized).filter(([key]) => key in payload),
    );
  }

  return normalized;
};

export const validateImportPayload = (payload) => {
  if (!Array.isArray(payload?.products) || payload.products.length === 0) {
    throw createHttpError(400, "products array is required");
  }

  return payload.products.map((product) => validateProductPayload(product));
};
