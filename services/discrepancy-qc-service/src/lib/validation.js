import { createHttpError } from "./http.js";

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeNullableString = (value) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const assertRecord = (value, fieldName) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(400, `${fieldName} is required`);
  }
  return value;
};

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
