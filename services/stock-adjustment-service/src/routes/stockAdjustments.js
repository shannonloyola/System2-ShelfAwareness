import express from "express";
import { asyncHandler } from "../lib/http.js";
import {
  approveStockAdjustment,
  createStockAdjustment,
  listStockAdjustments,
  rejectStockAdjustment,
} from "../repositories/stockAdjustmentRepository.js";
import {
  validateAdjustmentPayload,
  validateApprovalPayload,
  validateRejectionPayload,
  validateStatus,
} from "../lib/validation.js";

export const stockAdjustmentsRouter = express.Router();

stockAdjustmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = validateStatus(req.query.status);
    const result = await listStockAdjustments({
      status,
      requestHeaders: req.headers,
    });
    res.status(200).json({ data: result });
  }),
);

stockAdjustmentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateAdjustmentPayload(req.body);
    const result = await createStockAdjustment({
      payload,
      requestHeaders: req.headers,
    });
    res.status(201).json({ data: result });
  }),
);

stockAdjustmentsRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const { managerName } = validateApprovalPayload(req.body);
    const result = await approveStockAdjustment({
      adjustmentId: req.params.id,
      managerName,
      requestHeaders: req.headers,
    });
    res.status(200).json({ data: result });
  }),
);

stockAdjustmentsRouter.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const { managerName, note } = validateRejectionPayload(req.body);
    const result = await rejectStockAdjustment({
      adjustmentId: req.params.id,
      managerName,
      note,
      requestHeaders: req.headers,
    });
    res.status(200).json({ data: result });
  }),
);
