import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { sendNotification, listNotifications } from "../services/notificationService.js";

export const notificationsRouter = Router();

notificationsRouter.post(
  "/send",
  asyncHandler(async (req, res) => {
    const result = await sendNotification(req.body);
    res.status(202).json(result);
  }),
);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await listNotifications();
    res.json(notifications);
  }),
);
