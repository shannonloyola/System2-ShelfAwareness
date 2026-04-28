import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validateQualityCheckPayload } from "../lib/validation.js";
import { saveGrnQualityChecks } from "../repositories/discrepancyQcRepository.js";

export const grnQualityChecksRouter = express.Router();

grnQualityChecksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateQualityCheckPayload(req.body);
    const result = await saveGrnQualityChecks(payload);
    res.status(201).json({ data: result });
  }),
);
