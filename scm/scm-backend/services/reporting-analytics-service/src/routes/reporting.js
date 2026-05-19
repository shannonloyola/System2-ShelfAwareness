import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { generateReport, getDashboardData, getDashboardMetrics } from "../services/reportingService.js";
import { computeDelayRisk, computeProductAssociations } from "../services/dataMiningService.js";

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

// ── Data Mining: PO Delay Risk Classification ──
reportingRouter.get(
  "/po-delay-risk",
  asyncHandler(async (req, res) => {
    const supplierName = req.query.supplier_name;
    if (!supplierName) {
      return res.status(400).json({ error: "supplier_name query parameter is required" });
    }
    const result = await computeDelayRisk(String(supplierName));
    res.json(result);
  }),
);

// ── Data Mining: Product Association Rules ──
reportingRouter.get(
  "/product-associations",
  asyncHandler(async (req, res) => {
    const productName = req.query.product_name;
    if (!productName) {
      return res.status(400).json({ error: "product_name query parameter is required" });
    }
    const result = await computeProductAssociations(String(productName));
    res.json(result);
  }),
);
