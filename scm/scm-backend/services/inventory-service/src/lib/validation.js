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

export const parseListLimit = (query, fallback = 10) => {
  const limit = Number.parseInt(query.limit ?? String(fallback), 10);
  return Number.isNaN(limit) ? fallback : Math.min(Math.max(limit, 1), 100);
};

export const validateReceiveScanPayload = (payload) => {
  const normalized = {
    product_id: normalizeNullableString(payload.product_id),
    product_uuid: normalizeNullableString(payload.product_uuid),
    reserved_stock: normalizeInteger(payload.reserved_stock, 0),
    increment: normalizeInteger(payload.increment, 1),
  };

  if (!normalized.product_id && !normalized.product_uuid) {
    throw createHttpError(
      400,
      "product_id or product_uuid is required for stock sync",
    );
  }

  if (normalized.reserved_stock < 0) {
    throw createHttpError(400, "reserved_stock must be non-negative");
  }

  if (normalized.increment <= 0) {
    throw createHttpError(400, "increment must be greater than zero");
  }

  return normalized;
};
