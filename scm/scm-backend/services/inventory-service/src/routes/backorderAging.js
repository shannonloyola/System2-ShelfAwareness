import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { parseListLimit } from "../lib/validation.js";
import { listBackorderAging } from "../repositories/inventoryRepository.js";

export const backorderAgingRouter = express.Router();

backorderAgingRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using backorder aging endpoints.",
      ),
    );
    return;
  }

  next();
});

backorderAgingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseListLimit(req.query, 25);
    const rows = await listBackorderAging(limit);
    res.json({ data: rows, meta: { limit } });
  }),
);
