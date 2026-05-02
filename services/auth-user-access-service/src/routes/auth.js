import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { validateUserSession, checkPermissions } from "../services/authService.js";

export const authRouter = Router();

authRouter.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    const result = await validateUserSession(token);
    res.json(result);
  }),
);

authRouter.get(
  "/permissions",
  asyncHandler(async (req, res) => {
    const { userId, resource, action } = req.query;
    const result = await checkPermissions(userId, resource, action);
    res.json(result);
  }),
);
