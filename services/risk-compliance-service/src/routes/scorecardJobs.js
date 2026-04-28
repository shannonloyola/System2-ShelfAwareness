import express from "express";
import { asyncHandler } from "../lib/http.js";
import {
  calculateAndCacheSupplierScorecard,
  recalculateAllSupplierScorecards,
} from "../lib/scorecardCache.js";

export const scorecardJobsRouter = express.Router();

scorecardJobsRouter.post(
  "/recalculate",
  asyncHandler(async (req, res) => {
    const supplierName = String(
      req.body?.supplier_name || "",
    ).trim();

    if (supplierName) {
      const data =
        await calculateAndCacheSupplierScorecard(supplierName);
      res.json({
        message: "Supplier scorecard recalculated and cached",
        data,
      });
      return;
    }

    const result = await recalculateAllSupplierScorecards();
    res.json({
      message: "Monthly supplier scorecards recalculated and cached",
      data: result,
    });
  }),
);
