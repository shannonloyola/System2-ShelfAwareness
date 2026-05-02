import express from "express";
import { asyncHandler } from "../lib/http.js";
import { getShipmentByTracking, updateShipmentStatus, getPendingShipments, getTodayReceivedCount } from "../repositories/shipmentRepository.js";

export const shipmentsRouter = express.Router();

// GET /shipments?trackingNumber=:value
shipmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { trackingNumber } = req.query;
    if (!trackingNumber) {
      return res.status(400).json({ error: "trackingNumber query param is required" });
    }
    const shipment = await getShipmentByTracking(trackingNumber);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json({ data: shipment });
  }),
);

// GET /shipments/pending
shipmentsRouter.get(
  "/pending",
  asyncHandler(async (_req, res) => {
    const shipments = await getPendingShipments();
    res.json({ data: shipments });
  }),
);

// GET /shipments/stats/today
shipmentsRouter.get(
  "/stats/today",
  asyncHandler(async (_req, res) => {
    const count = await getTodayReceivedCount();
    res.json({ data: { receivedToday: count } });
  }),
);

// PATCH /shipments/:id/status
shipmentsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, receivedBy, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status is required in request body" });
    }
    const result = await updateShipmentStatus({ id, status, receivedBy, notes });
    res.json({ data: result });
  }),
);
