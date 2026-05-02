import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { listPricingHistory } from "../repositories/productsRepository.js";

export const pricingRouter = express.Router();

pricingRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using pricing endpoints.",
      ),
    );
    return;
  }

  next();
});

pricingRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const pricing = await listPricingHistory();
    res.json({ data: pricing });
  }),
);
