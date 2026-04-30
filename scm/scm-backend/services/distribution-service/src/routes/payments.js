import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validatePaymentPayload } from "../lib/validation.js";
import { createPayment } from "../repositories/distributionRepository.js";

export const paymentsRouter = express.Router();

paymentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validatePaymentPayload(req.body);
    const result = await createPayment(payload);
    res.status(201).json({ data: result });
  }),
);
