import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { listCategories } from "../repositories/productsRepository.js";

export const categoriesRouter = express.Router();

categoriesRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using category endpoints.",
      ),
    );
    return;
  }

  next();
});

categoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await listCategories();
    res.json({ data: categories });
  }),
);
