import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validateLimit } from "../lib/validation.js";
import { listShelfItems } from "../repositories/cycleCountingRepository.js";

export const shelfItemsRouter = express.Router();

shelfItemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = validateLimit(req.query.limit, 100);
    const result = await listShelfItems({ limit });
    res.status(200).json({ data: result });
  }),
);
