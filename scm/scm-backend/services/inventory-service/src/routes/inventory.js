import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { parsePagination, validateReceiveScanPayload } from "../lib/validation.js";
import {
  getInventoryItem,
  listInventory,
  receiveScan,
} from "../repositories/inventoryRepository.js";

export const inventoryRouter = express.Router();

inventoryRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using inventory endpoints.",
      ),
    );
    return;
  }

  next();
});

inventoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    const items = await listInventory(pagination);
    res.json({ data: items, pagination });
  }),
);

inventoryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await getInventoryItem(req.params.id);
    res.json({ data: item });
  }),
);

inventoryRouter.post(
  "/receive-scan",
  asyncHandler(async (req, res) => {
    const payload = validateReceiveScanPayload(req.body);
    const item = await receiveScan(payload);
    res.json({ data: item });
  }),
);
