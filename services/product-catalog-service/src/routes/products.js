import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { parsePagination, validateImportPayload, validateProductPayload } from "../lib/validation.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  importProducts,
  listProducts,
  updateProduct,
} from "../repositories/productsRepository.js";

export const productsRouter = express.Router();

productsRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using product catalog endpoints.",
      ),
    );
    return;
  }

  next();
});

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    const products = await listProducts(pagination);
    res.json({ data: products, pagination });
  }),
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    res.json({ data: product });
  }),
);

productsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateProductPayload(req.body);
    const product = await createProduct(payload);
    res.status(201).json({ data: product });
  }),
);

productsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const products = validateImportPayload(req.body);
    const created = await importProducts(products);
    res.status(201).json({
      data: created,
      meta: { inserted: created.length },
    });
  }),
);

productsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = validateProductPayload(req.body, {
      partial: true,
    });
    const product = await updateProduct(req.params.id, payload);
    res.json({ data: product });
  }),
);

productsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await deleteProduct(req.params.id);
    res.json({
      message: "Product deleted successfully",
      data: result,
    });
  }),
);
