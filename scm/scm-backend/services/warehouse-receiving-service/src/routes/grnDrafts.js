import express from "express";
import { asyncHandler } from "../lib/http.js";
import { validateDraftPayload, validatePostPayload } from "../lib/validation.js";
import { postGrnDraft, saveGrnDraft } from "../repositories/warehouseRepository.js";

export const grnDraftsRouter = express.Router();

grnDraftsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = validateDraftPayload(req.body);
    const result = await saveGrnDraft(payload);
    res.status(201).json({ data: result });
  }),
);

grnDraftsRouter.post(
  "/:id/post",
  asyncHandler(async (req, res) => {
    const { postedBy } = validatePostPayload(req.body);
    const result = await postGrnDraft({
      grnDraftId: req.params.id,
      postedBy,
    });
    res.json({ data: result });
  }),
);
