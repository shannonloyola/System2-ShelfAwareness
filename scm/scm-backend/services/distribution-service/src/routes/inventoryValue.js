import express from "express";
import { asyncHandler } from "../lib/http.js";
import {
  captureInventoryValueSnapshot,
  listInventoryValueByCategory,
  listInventoryValueHistory,
  listInventoryValueTotal,
} from "../repositories/distributionRepository.js";

export const inventoryValueRouter = express.Router();

inventoryValueRouter.get(
  "/total",
  asyncHandler(async (_req, res) => {
    const total = await listInventoryValueTotal();
    res.json({ data: { total_inventory_value_php: total } });
  }),
);

inventoryValueRouter.get(
  "/by-category",
  asyncHandler(async (_req, res) => {
    const rows = await listInventoryValueByCategory();
    res.json({ data: rows });
  }),
);

inventoryValueRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    const rows = await listInventoryValueHistory(days);
    res.json({ data: rows });
  }),
);

inventoryValueRouter.post(
  "/snapshots/capture",
  asyncHandler(async (req, res) => {
    const snapshot = await captureInventoryValueSnapshot({
      snapshotDate: req.body?.snapshot_date,
      notes: req.body?.notes,
      source: req.body?.source,
    });
    res.status(201).json({ data: snapshot });
  }),
);
