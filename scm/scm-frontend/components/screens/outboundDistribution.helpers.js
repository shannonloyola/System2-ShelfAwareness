export const triggerPdfDownload = ({
  blob,
  filename,
  documentRef,
  urlRef,
  blobFactory = Blob,
}) => {
  const pdfBlob = new blobFactory([blob], { type: "application/pdf" });
  const objectUrl = urlRef.createObjectURL(pdfBlob);
  const link = documentRef.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";

  documentRef.body.appendChild(link);
  link.click();
  documentRef.body.removeChild(link);
  urlRef.revokeObjectURL(objectUrl);

  return {
    filename,
    objectUrl,
  };
};

export const getFulfillmentUiState = (fulfillment = {}) => {
  const status = fulfillment.status === "partially_fulfilled"
    ? "partially_fulfilled"
    : "fulfilled";
  const backorderedQty = Number(fulfillment.qty_backordered_total ?? 0);

  return {
    status,
    toastTitle:
      status === "partially_fulfilled"
        ? "Order partially fulfilled"
        : "Order fulfilled",
    toastDescription:
      backorderedQty > 0
        ? `${backorderedQty} unit(s) moved to backorder.`
        : "All ordered quantities were allocated from stock.",
  };
};
