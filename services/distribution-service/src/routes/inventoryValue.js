import express from "express";
import { asyncHandler } from "../lib/http.js";
import {
  listInventoryValueByCategory,
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
