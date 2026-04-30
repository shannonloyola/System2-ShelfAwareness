import { createHttpError } from "../lib/http.js";

export const uploadDocument = async (payload) => {
  const { fileName, content, mimeType } = payload;

  if (!fileName || !content) {
    throw createHttpError(400, "Missing required fields: fileName, content");
  }

  console.log(`[DocumentService] Uploading document: ${fileName} (${mimeType || "unknown"})...`);

  // Simulation
  await new Promise((resolve) => setTimeout(resolve, 150));

  return {
    documentId: `doc_${Math.random().toString(36).substr(2, 9)}`,
    fileName,
    url: `https://storage.example.com/docs/${fileName}`,
    uploadedAt: new Date().toISOString(),
  };
};

export const getDocumentMetadata = async (documentId) => {
  return {
    documentId,
    fileName: "example.pdf",
    size: 1024 * 50,
    mimeType: "application/pdf",
  };
};
