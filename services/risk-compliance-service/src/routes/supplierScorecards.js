import express from "express";
import {
  hasDatabaseConfig,
  hasSupabaseRestConfig,
} from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import {
  calculateAndCacheSupplierScorecard,
  getCachedScorecard,
} from "../lib/scorecardCache.js";

export const supplierScorecardsRouter = express.Router();

supplierScorecardsRouter.use((_req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "Configure risk compliance service database or Supabase REST access before using supplier scorecards.",
      ),
    );
    return;
  }

  next();
});

supplierScorecardsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const supplierName = String(
      req.query.supplier_name || "",
    ).trim();

    if (!supplierName) {
      throw createHttpError(
        400,
        "supplier_name query parameter is required",
      );
    }

    if (!hasSupabaseRestConfig && !hasDatabaseConfig) {
      throw createHttpError(
        503,
        "Supplier scorecard lookup is not configured.",
      );
    }

    const forceRefresh =
      String(req.query.refresh || "").toLowerCase() === "true";

    if (!forceRefresh) {
      const cached = await getCachedScorecard(supplierName);
      if (cached) {
        res.json({ data: cached, cached: true });
        return;
      }
    }

    const scorecard =
      await calculateAndCacheSupplierScorecard(supplierName);
    res.json({ data: scorecard, cached: false });
  }),
);
