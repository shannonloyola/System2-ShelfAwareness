import express from "express";
import { asyncHandler, createHttpError } from "../lib/http.js";
import { getProductByBarcode } from "../repositories/cycleCountingRepository.js";

export const productsRouter = express.Router();

productsRouter.get(
  "/by-barcode/:barcode",
  asyncHandler(async (req, res) => {
    const barcode = String(req.params.barcode || "").trim();
    if (!barcode) {
      throw createHttpError(400, "barcode is required");
    }

    const product = await getProductByBarcode(barcode);
    if (!product) {
      throw createHttpError(404, "No product found for this barcode");
    }

    res.status(200).json({ data: product });
  }),
);
