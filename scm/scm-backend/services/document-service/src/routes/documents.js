import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { uploadDocument, getDocumentMetadata } from "../services/documentService.js";

export const documentsRouter = Router();

documentsRouter.post(
  "/upload",
  asyncHandler(async (req, res) => {
    const result = await uploadDocument(req.body);
    res.status(201).json(result);
  }),
);

documentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const metadata = await getDocumentMetadata(req.params.id);
    res.json(metadata);
  }),
);
