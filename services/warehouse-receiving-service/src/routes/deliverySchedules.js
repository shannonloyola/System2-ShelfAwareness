import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validateDeliverySchedulePayload } from "../lib/validation.js";
import { scheduleDelivery } from "../repositories/warehouseRepository.js";

export const deliverySchedulesRouter = express.Router();

deliverySchedulesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateDeliverySchedulePayload(req.body);
    const result = await scheduleDelivery(payload);
    res.status(201).json({ data: result });
  }),
);
