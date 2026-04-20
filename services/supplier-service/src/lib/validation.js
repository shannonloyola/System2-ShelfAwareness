import { createHttpError } from "./http.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNullableString = (value) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

export const parsePagination = (query) => {
  const limit = Number.parseInt(query.limit ?? "20", 10);
  const offset = Number.parseInt(query.offset ?? "0", 10);
  const search = normalizeString(query.search);

  return {
    limit: Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100),
    offset: Number.isNaN(offset) ? 0 : Math.max(offset, 0),
    search,
  };
};

export const validateSupplierPayload = (payload, { partial = false } = {}) => {
  const normalized = {
    supplier_name: normalizeString(payload.supplier_name),
    contact_person: normalizeNullableString(payload.contact_person),
    email: normalizeNullableString(payload.email),
    phone: normalizeNullableString(payload.phone),
    address: normalizeNullableString(payload.address),
    currency_code: normalizeNullableString(payload.currency_code),
    lead_time_days:
      payload.lead_time_days === undefined ||
      payload.lead_time_days === null ||
      payload.lead_time_days === ""
        ? null
        : Number.parseInt(String(payload.lead_time_days), 10),
    status: normalizeNullableString(payload.status) ?? "Active",
  };

  if (!partial && !normalized.supplier_name) {
    throw createHttpError(400, "supplier_name is required");
  }

  if (partial && Object.keys(payload).length === 0) {
    throw createHttpError(400, "At least one field is required for update");
  }

  if (
    payload.supplier_name !== undefined &&
    !normalized.supplier_name
  ) {
    throw createHttpError(400, "supplier_name cannot be empty");
  }

  if (
    normalized.email &&
    !EMAIL_REGEX.test(normalized.email)
  ) {
    throw createHttpError(400, "email must be a valid email address");
  }

  if (
    normalized.status &&
    !["active", "suspended"].includes(normalized.status.toLowerCase())
  ) {
    throw createHttpError(400, "status must be either Active or Suspended");
  }

  if (normalized.status) {
    normalized.status =
      normalized.status.toLowerCase() === "active"
        ? "Active"
        : "Suspended";
  }

  if (
    normalized.lead_time_days !== null &&
    Number.isNaN(normalized.lead_time_days)
  ) {
    throw createHttpError(400, "lead_time_days must be a valid integer");
  }

  if (
    normalized.lead_time_days !== null &&
    normalized.lead_time_days < 0
  ) {
    throw createHttpError(400, "lead_time_days cannot be negative");
  }

  if (partial) {
    return Object.fromEntries(
      Object.entries(normalized).filter(([key, value]) => {
        return key in payload && value !== undefined;
      }),
    );
  }

  return normalized;
};
