import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import {
  parsePagination,
  validateBulkImportPayload,
  validatePurchaseOrderItemPayload,
  validatePurchaseOrderPayload,
  validateStatusTransition,
} from "../lib/validation.js";
import {
  createPurchaseOrder,
  createPurchaseOrderItem,
  deletePurchaseOrderItem,
  generateNextPONumber,
  getPurchaseOrderById,
  importPurchaseOrder,
  listPurchaseOrderItems,
  listPurchaseOrders,
  updatePurchaseOrder,
  updatePurchaseOrderItem,
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
