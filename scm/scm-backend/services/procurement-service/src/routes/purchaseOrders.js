import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import {
  validateFreightQuotePayload,
  validateApprovalPayload,
  parsePagination,
  validateDocumentPayload,
  validateBulkImportPayload,
  validateEtaPayload,
  validatePurchaseOrderItemPayload,
  validatePurchaseOrderPayload,
  validateStatusTransition,
  validateTransitStatusPayload,
} from "../lib/validation.js";
import {
  appendPurchaseOrderStatusHistory,
  createFreightQuote,
  createPurchaseOrder,
  createPurchaseOrderItem,
  deletePurchaseOrderItem,
  generateNextPONumber,
  getFreightQuotes,
  getCurrentMonthlyBudget,
  getPurchaseOrderById,
  importPurchaseOrder,
  listCustomsDelays,
  listExpiredReservations,
  listExpiringSoonReservations,
  listPurchaseOrderItems,
  listPurchaseOrderStatusHistory,
  listPurchaseOrders,
  runExpirationCheck,
  setWinnerFreightQuote,
  updateLatestPurchaseOrderDocument,
  updatePurchaseOrderApproval,
  updatePurchaseOrderEta,
  updatePurchaseOrder,
  updatePurchaseOrderItem,
  updateTransitStatus,
} from "../repositories/purchaseOrdersRepository.js";

export const purchaseOrdersRouter = express.Router();

purchaseOrdersRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using procurement endpoints.",
      ),
    );
    return;
  }

  next();
});

purchaseOrdersRouter.get(
  "/dashboard/monthly-budget/current",
  asyncHandler(async (_req, res) => {
    const budget = await getCurrentMonthlyBudget();
    res.json({ data: budget });
  }),
);

purchaseOrdersRouter.get(
  "/dashboard/customs-delays",
  asyncHandler(async (_req, res) => {
    const rows = await listCustomsDelays();
    res.json({ data: rows });
  }),
);

purchaseOrdersRouter.get(
  "/reservations/expiring-soon",
  asyncHandler(async (_req, res) => {
    const rows = await listExpiringSoonReservations();
    res.json({ data: rows });
  }),
);

purchaseOrdersRouter.get(
  "/reservations/expired",
  asyncHandler(async (_req, res) => {
    const rows = await listExpiredReservations();
    res.json({ data: rows });
  }),
);

purchaseOrdersRouter.post(
  "/reservations/expire",
  asyncHandler(async (_req, res) => {
    const result = await runExpirationCheck();
    res.json({ data: result ?? [] });
  }),
);

purchaseOrdersRouter.get(
  "/next-number",
  asyncHandler(async (_req, res) => {
    const po_no = await generateNextPONumber();
    res.json({ data: { po_no } });
  }),
);

purchaseOrdersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    const purchaseOrders = await listPurchaseOrders(pagination);
    res.json({
      data: purchaseOrders,
      pagination,
    });
  }),
);

purchaseOrdersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validatePurchaseOrderPayload(req.body);
    const purchaseOrder = await createPurchaseOrder(payload);
    res.status(201).json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const payload = validateBulkImportPayload(req.body);
    const purchaseOrder = await importPurchaseOrder(payload);
    res.status(201).json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const purchaseOrder = await getPurchaseOrderById(req.params.id);
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = validatePurchaseOrderPayload(req.body, {
      partial: true,
    });
    const purchaseOrder = await updatePurchaseOrder(req.params.id, payload);
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/approval",
  asyncHandler(async (req, res) => {
    const payload = validateApprovalPayload(req.body);
    const purchaseOrder = await updatePurchaseOrderApproval(
      req.params.id,
      payload,
    );
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/eta",
  asyncHandler(async (req, res) => {
    const payload = validateEtaPayload(req.body);
    const purchaseOrder = await updatePurchaseOrderEta(req.params.id, payload);
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.get(
  "/:id/freight-quotes",
  asyncHandler(async (req, res) => {
    const quotes = await getFreightQuotes(req.params.id);
    res.json({ data: quotes });
  }),
);

purchaseOrdersRouter.post(
  "/:id/freight-quotes",
  asyncHandler(async (req, res) => {
    const payload = validateFreightQuotePayload(req.body);
    const purchaseOrder = await getPurchaseOrderById(req.params.id);
    const quote = await createFreightQuote(
      req.params.id,
      purchaseOrder.po_no,
      payload,
    );
    res.status(201).json({ data: quote });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/freight-quotes/:quoteId/winner",
  asyncHandler(async (req, res) => {
    const quote = await setWinnerFreightQuote(
      req.params.id,
      req.params.quoteId,
    );
    res.json({ data: quote });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/transit-status",
  asyncHandler(async (req, res) => {
    const payload = validateTransitStatusPayload(req.body);
    const purchaseOrder = await updateTransitStatus(req.params.id, payload);
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const history = await listPurchaseOrderStatusHistory(req.params.id);
    res.json({ data: history });
  }),
);

purchaseOrdersRouter.post(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const payload = req.body ?? {};
    if (!payload.status_name) {
      payload.status_name = "Pending Supplier Confirmation";
    }
    const history = await appendPurchaseOrderStatusHistory(req.params.id, payload);
    res.status(201).json({ data: history });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/history/latest-document",
  asyncHandler(async (req, res) => {
    const payload = validateDocumentPayload(req.body);
    const history = await updateLatestPurchaseOrderDocument(req.params.id, payload);
    res.json({ data: history });
  }),
);

purchaseOrdersRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const current = await getPurchaseOrderById(req.params.id);
    const targetStatus = String(req.body?.status || "");
    validateStatusTransition(current.status, targetStatus);
    const purchaseOrder = await updatePurchaseOrder(req.params.id, {
      status: targetStatus,
    });
    res.json({ data: purchaseOrder });
  }),
);

purchaseOrdersRouter.get(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const items = await listPurchaseOrderItems(req.params.id);
    res.json({ data: items });
  }),
);

purchaseOrdersRouter.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const payload = validatePurchaseOrderItemPayload(req.body);
    const item = await createPurchaseOrderItem(req.params.id, payload);
    res.status(201).json({ data: item });
  }),
);

purchaseOrdersRouter.put(
  "/:id/items/:itemId",
  asyncHandler(async (req, res) => {
    const payload = validatePurchaseOrderItemPayload(req.body);
    const item = await updatePurchaseOrderItem(
      req.params.id,
      req.params.itemId,
      payload,
    );
    res.json({ data: item });
  }),
);

purchaseOrdersRouter.delete(
  "/:id/items/:itemId",
  asyncHandler(async (req, res) => {
    const result = await deletePurchaseOrderItem(
      req.params.id,
      req.params.itemId,
    );
    res.json({
      message: "Purchase order item deleted successfully",
      data: result,
    });
  }),
);
