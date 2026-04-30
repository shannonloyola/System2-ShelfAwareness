import express from "express";
import { asyncHandler, createHttpError } from "../lib/http.js";
import {
  cancelOrder,
  createOrder,
  getInvoice,
  listOrderPayments,
  listOrders,
  updateOrderLines,
} from "../repositories/distributionRepository.js";
import {
  validateCancelOrderPayload,
  validateCreateOrderPayload,
  validateOrderLineUpdatePayload,
} from "../lib/validation.js";

export const ordersRouter = express.Router();

ordersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await listOrders();
    res.json({ data: rows });
  }),
);

ordersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateCreateOrderPayload(req.body);
    const result = await createOrder(payload);
    res.status(201).json({ data: result });
  }),
);

ordersRouter.patch(
  "/:id/lines",
  asyncHandler(async (req, res) => {
    const payload = validateOrderLineUpdatePayload(req.body);
    const result = await updateOrderLines(req.params.id, payload.lines);
    res.json({ data: result });
  }),
);

ordersRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    validateCancelOrderPayload(req.body);
    const result = await cancelOrder(req.params.id);
    if (!result?.success) {
      throw createHttpError(400, result?.error || "Order cancellation failed");
    }
    res.json({ data: result });
  }),
);

ordersRouter.get(
  "/:id/invoice",
  asyncHandler(async (req, res) => {
    const { buffer, contentType } = await getInvoice(req.params.id);
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  }),
);

ordersRouter.get(
  "/:id/payments",
  asyncHandler(async (req, res) => {
    const retailerName = String(req.query.retailer_name || "").trim();
    const orderNo = String(req.query.order_no || "").trim();
    const orderTotal = Number(req.query.order_total ?? 0);

    if (!retailerName || !orderNo) {
      throw createHttpError(400, "retailer_name and order_no are required");
    }

    const result = await listOrderPayments({
      retailerName,
      orderNo,
      orderTotal,
    });
    res.json({ data: result });
  }),
);
