import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { generateReport, getDashboardData, getDashboardMetrics } from "../services/reportingService.js";

export const reportingRouter = Router();

reportingRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const result = await generateReport(req.body);
    res.status(201).json(result);
  }),
);

reportingRouter.get(
  "/dashboard-metrics",
  asyncHandler(async (_req, res) => {
    const metrics = await getDashboardMetrics();
    res.json(metrics);
  }),
);

reportingRouter.get(
  "/dashboard-data",
  asyncHandler(async (_req, res) => {
    const dashboardData = await getDashboardData();
    res.json(dashboardData);
  }),
);
