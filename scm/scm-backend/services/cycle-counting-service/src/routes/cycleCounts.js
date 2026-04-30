import express from "express";
import { asyncHandler } from "../lib/http.js";
import {
  validateBulkCycleCountPayload,
  validateCycleCountPayload,
  validateLimit,
} from "../lib/validation.js";
import {
  createBulkCycleCounts,
  createCycleCount,
  listRecentCycleCounts,
} from "../repositories/cycleCountingRepository.js";

export const cycleCountsRouter = express.Router();

cycleCountsRouter.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const limit = validateLimit(req.query.limit, 5);
    const result = await listRecentCycleCounts({ limit });
    res.status(200).json({ data: result });
  }),
);

cycleCountsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateCycleCountPayload(req.body);
    const result = await createCycleCount(payload);
    res.status(201).json({ data: result });
  }),
);

cycleCountsRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const payload = validateBulkCycleCountPayload(req.body);
    const result = await createBulkCycleCounts(payload);
    res.status(200).json({
      data: {
        saved: result.saved,
        failures: result.failures,
        successCount: result.saved.length,
        errorCount: result.failures.length,
      },
    });
  }),
);
