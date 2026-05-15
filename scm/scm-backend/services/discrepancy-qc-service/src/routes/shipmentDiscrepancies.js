import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validateShipmentDiscrepancyUpdatePayload } from "../lib/validation.js";
import {
  getQualityReportsSummary,
  listShipmentDiscrepancies,
  updateShipmentDiscrepancy,
} from "../repositories/discrepancyQcRepository.js";

export const shipmentDiscrepanciesRouter = express.Router();

shipmentDiscrepanciesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const excludeApproved = String(req.query.excludeApproved || "").toLowerCase() === "true";
    const rows = await listShipmentDiscrepancies({ excludeApproved });
    res.json({ data: rows });
  }),
);

shipmentDiscrepanciesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = validateShipmentDiscrepancyUpdatePayload(req.body);
    const row = await updateShipmentDiscrepancy(req.params.id, payload);
    res.json({ data: row });
  }),
);

shipmentDiscrepanciesRouter.get(
  "/reports/summary",
  asyncHandler(async (_req, res) => {
    const summary = await getQualityReportsSummary();
    res.json({ data: summary });
  }),
);
