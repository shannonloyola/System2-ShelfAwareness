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

export const validateCreateOrderPayload = (payload) => {
  const retailer_name = normalizeNullableString(payload?.retailer_name);
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];

  if (!retailer_name) {
    throw createHttpError(400, "retailer_name is required");
  }

  if (lines.length === 0) {
    throw createHttpError(400, "lines must contain at least one item");
  }

  const normalizedLines = lines.map((line, index) => {
    const sku = normalizeNullableString(line?.sku);
    const qty = normalizeInteger(line?.qty, 0);

    if (!sku || qty <= 0) {
      throw createHttpError(
        400,
        `Invalid line at index ${index}: sku and qty > 0 are required`,
      );
    }

    return { sku, qty };
  });

  return {
    retailer_name,
    branch_suffix: normalizeNullableString(payload?.branch_suffix),
    payment_terms: normalizeNullableString(payload?.payment_terms),
    due_date: normalizeNullableString(payload?.due_date),
    notes: normalizeNullableString(payload?.notes),
    priority_level: normalizeNullableString(payload?.priority_level),
    lines: normalizedLines,
  };
};

export const validateOrderLineUpdatePayload = (payload) => {
  const lines = Array.isArray(payload?.lines) ? payload.lines : [];
  if (lines.length === 0) {
    throw createHttpError(400, "lines must contain at least one item");
  }

  return {
    lines: lines.map((line, index) => {
      const sku = normalizeNullableString(line?.sku);
      const qty = normalizeInteger(line?.qty, 0);

      if (!sku || qty <= 0) {
        throw createHttpError(
          400,
          `Invalid line at index ${index}: sku and qty > 0 are required`,
        );
      }

      return { sku, qty };
    }),
  };
};

export const validateCancelOrderPayload = (payload) => ({
  reason: normalizeNullableString(payload?.reason),
});

export const validatePaymentPayload = (payload) => {
  const supplier_name = normalizeNullableString(payload?.supplier_name);
  const amount = normalizeNumber(payload?.amount, 0);
  const payment_date = normalizeNullableString(payload?.payment_date);
  const reference_no = normalizeNullableString(payload?.reference_no);

  if (!supplier_name || amount <= 0 || !payment_date || !reference_no) {
    throw createHttpError(
      400,
      "supplier_name, amount > 0, payment_date, and reference_no are required",
    );
  }

  return {
    supplier_name,
    amount,
    payment_date,
    payment_method: normalizeNullableString(payload?.payment_method) ?? "Check",
    reference_no,
    notes: normalizeNullableString(payload?.notes),
  };
};
