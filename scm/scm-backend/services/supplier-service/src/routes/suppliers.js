import express from "express";
import { hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { parsePagination, validateSupplierPayload } from "../lib/validation.js";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSupplierByName,
  listSuppliers,
  updateSupplier,
} from "../repositories/suppliersRepository.js";

export const suppliersRouter = express.Router();

suppliersRouter.use((req, _res, next) => {
  if (!hasDatabaseConfig && !hasSupabaseRestConfig) {
    next(
      createHttpError(
        503,
        "DATABASE_URL is not set. Configure DATABASE_URL or Supabase REST env vars before using supplier CRUD endpoints.",
      ),
    );
    return;
  }

  next();
});

suppliersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query);
    const suppliers = await listSuppliers(pagination);

    res.json({
      data: suppliers,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        search: pagination.search,
      },
    });
  }),
);

suppliersRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const supplierName = String(req.query.name || "").trim();
    if (!supplierName) {
      throw createHttpError(
        400,
        "name query parameter is required",
      );
    }

    const supplier = await getSupplierByName(supplierName);
    res.json({ data: supplier });
  }),
);

suppliersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const supplier = await getSupplierById(req.params.id);
    res.json({ data: supplier });
  }),
);

suppliersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateSupplierPayload(req.body);
    const supplier = await createSupplier(payload);
    res.status(201).json({ data: supplier });
  }),
);

suppliersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = validateSupplierPayload(req.body, {
      partial: true,
    });
    const supplier = await updateSupplier(req.params.id, payload);
    res.json({ data: supplier });
  }),
);

suppliersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const result = await deleteSupplier(req.params.id);
    res.json({
      message: "Supplier deleted successfully",
      data: result,
    });
  }),
);
