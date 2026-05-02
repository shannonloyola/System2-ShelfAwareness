import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { parseListLimit } from "../lib/validation.js";
import { listBackorderAlerts } from "../repositories/inventoryRepository.js";

export const backorderAlertsRouter = express.Router();

backorderAlertsRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using backorder alert endpoints.",
      ),
    );
    return;
  }

  next();
});

backorderAlertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseListLimit(req.query, 10);
    const rows = await listBackorderAlerts(limit);
    res.json({ data: rows, meta: { limit } });
  }),
);
