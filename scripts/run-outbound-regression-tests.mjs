import assert from "node:assert/strict";

import {
  getFulfillmentUiState,
  triggerPdfDownload,
} from "../src/app/components/screens/outboundDistribution.helpers.js";

const run = (name, fn) => {
  fn();
  console.log(`PASS ${name}`);
};

run("triggerPdfDownload creates a hidden anchor and forces a download", () => {
  const events = [];
  const fakeLink = {
    href: "",
    download: "",
    style: {},
    click() {
      events.push("click");
    },
  };

  const fakeDocument = {
    body: {
      appendChild(node) {
        events.push(["append", node]);
      },
      removeChild(node) {
        events.push(["remove", node]);
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "a");
      return fakeLink;
    },
  };

  const fakeUrl = {
    createObjectURL(blob) {
      events.push(["createObjectURL", blob.type]);
      return "blob:invoice";
    },
    revokeObjectURL(url) {
      events.push(["revokeObjectURL", url]);
    },
  };

  class FakeBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type;
    }
  }

  const result = triggerPdfDownload({
    blob: { id: "pdf-response" },
    filename: "RO-123.pdf",
    documentRef: fakeDocument,
    urlRef: fakeUrl,
    blobFactory: FakeBlob,
  });

  assert.equal(result.filename, "RO-123.pdf");
  assert.equal(fakeLink.href, "blob:invoice");
  assert.equal(fakeLink.download, "RO-123.pdf");
  assert.equal(fakeLink.style.display, "none");
  assert.deepEqual(events, [
    ["createObjectURL", "application/pdf"],
    ["append", fakeLink],
    "click",
    ["remove", fakeLink],
    ["revokeObjectURL", "blob:invoice"],
  ]);
});

run("getFulfillmentUiState returns fulfilled copy", () => {
  assert.deepEqual(
    getFulfillmentUiState({
      status: "fulfilled",
      qty_backordered_total: 0,
    }),
    {
      status: "fulfilled",
      toastTitle: "Order fulfilled",
      toastDescription: "All ordered quantities were allocated from stock.",
    },
  );
});

run("getFulfillmentUiState returns partial fulfillment copy", () => {
  assert.deepEqual(
    getFulfillmentUiState({
      status: "partially_fulfilled",
      qty_backordered_total: 3,
    }),
    {
      status: "partially_fulfilled",
      toastTitle: "Order partially fulfilled",
      toastDescription: "3 unit(s) moved to backorder.",
    },
  );
});

console.log("Outbound regression checks passed.");
