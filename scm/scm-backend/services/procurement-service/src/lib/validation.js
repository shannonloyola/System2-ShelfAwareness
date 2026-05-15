import { createHttpError } from "./http.js";

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
  const status = normalizeString(query.status);

  return {
    limit: Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100),
    offset: Number.isNaN(offset) ? 0 : Math.max(offset, 0),
    search,
    status,
  };
};

export const validatePurchaseOrderPayload = (
  payload,
  { partial = false } = {},
) => {
  const normalized = {
    po_no: normalizeNullableString(payload.po_no),
    supplier_name: normalizeNullableString(payload.supplier_name),
    status: normalizeNullableString(payload.status) ?? "Draft",
    expected_delivery_date: normalizeNullableString(
      payload.expected_delivery_date,
    ),
    preferred_communication: normalizeNullableString(
      payload.preferred_communication,
    ),
    paid_at: normalizeNullableString(payload.paid_at),
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
    payload.status !== undefined &&
    !normalized.status
  ) {
    throw createHttpError(400, "status cannot be empty");
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

export const validatePurchaseOrderItemPayload = (payload) => {
  const item_name = normalizeString(payload.item_name);
  const quantity = Number.parseInt(String(payload.quantity), 10);

  if (!item_name) {
    throw createHttpError(400, "item_name is required");
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    throw createHttpError(400, "quantity must be greater than 0");
  }

  return {
    item_name,
    quantity,
  };
};

export const validateStatusTransition = (currentStatus, targetStatus) => {
  const current = normalizeString(currentStatus).toLowerCase();
  const target = normalizeString(targetStatus).toLowerCase();
  const allowed = {
    draft: ["posted"],
    "pending supplier confirmation": ["posted"],
    posted: ["in-transit"],
    "in-transit": ["received"],
    received: [],
  };

  const allowedTargets = allowed[current] ?? [];
  if (!allowedTargets.includes(target)) {
    throw createHttpError(
      400,
      `Cannot move from "${currentStatus ?? "Unknown"}" to "${targetStatus}"`,
    );
  }

  return targetStatus;
};

export const validateBulkImportPayload = (payload) => {
  const header = validatePurchaseOrderPayload(payload);
  const items = Array.isArray(payload.items)
    ? payload.items.map(validatePurchaseOrderItemPayload)
    : [];

  if (items.length === 0) {
    throw createHttpError(
      400,
      "At least one valid item is required for import",
    );
  }

  return {
    ...header,
    items,
  };
};

export const validateApprovalPayload = (payload) => {
  const approval_status = normalizeNullableString(payload?.approval_status);
  const rejection_reason = normalizeNullableString(payload?.rejection_reason);
  const approved_by = normalizeNullableString(payload?.approved_by);

  if (!approval_status) {
    throw createHttpError(400, "approval_status is required");
  }

  const normalizedStatus = approval_status.toLowerCase();
  if (!["approved", "rejected", "pending"].includes(normalizedStatus)) {
    throw createHttpError(
      400,
      "approval_status must be Approved, Rejected, or Pending",
    );
  }

  if (normalizedStatus === "rejected" && !rejection_reason) {
    throw createHttpError(400, "rejection_reason is required when rejecting");
  }

  return {
    approval_status:
      normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1),
    rejection_reason,
    approved_by,
  };
};

export const validateEtaPayload = (payload) => {
  const expected_delivery_date = normalizeNullableString(
    payload?.expected_delivery_date,
  );
  const reason = normalizeNullableString(payload?.reason);

  if (!expected_delivery_date) {
    throw createHttpError(400, "expected_delivery_date is required");
  }

  if (!reason) {
    throw createHttpError(400, "reason is required");
  }

  return {
    expected_delivery_date,
    reason,
  };
};

export const validateDocumentPayload = (payload) => {
  const document_url = normalizeNullableString(payload?.document_url);
  const status_name = normalizeNullableString(payload?.status_name);

  if (!document_url) {
    throw createHttpError(400, "document_url is required");
  }

  return {
    document_url,
    status_name,
  };
};
