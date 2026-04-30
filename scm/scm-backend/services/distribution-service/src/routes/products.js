import express from "express";
import { asyncHandler } from "../lib/http.js";
import { listAvailableProducts } from "../repositories/distributionRepository.js";

export const productsRouter = express.Router();

productsRouter.get(
  "/availability",
  asyncHandler(async (_req, res) => {
    const rows = await listAvailableProducts();
    res.json({ data: rows });
  }),
);
