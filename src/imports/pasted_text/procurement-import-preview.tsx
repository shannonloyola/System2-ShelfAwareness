Here’s a single **file‑style prompt** you can paste into Figma AI that includes the **instructions** and the **code changes** (no file edits by me):

```
BEGIN FILE: prompt.txt
INSTRUCTIONS FOR FIGMA AI:
- You are designing a UI update, not writing code.
- Use the code below only to understand layout and required fields. Do NOT render the code.
- In the Procurement tab, add an import preview modal.
- The modal contains a data table showing the parsed JSON array (SKU + Qty).
- Add a red highlight row style for mismatched SKUs (not found in system).
- Disable the “Submit Import” button until all mismatches are resolved.
- Show a small summary line: “X mismatches found” when errors exist.
- Keep layout, spacing, and styling consistent with the existing Procurement screen.

CODE (apply in src/app/components/screens/InboundProcurement.tsx):

1) Add imports
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

2) Add new state + helpers inside InboundProcurement()
const [showImportPreview, setShowImportPreview] = useState(false);
const [previewRows, setPreviewRows] = useState<CSVRow[]>([]);
const [skuMismatchSet, setSkuMismatchSet] = useState<Set<string>>(new Set());
const [checkingSkus, setCheckingSkus] = useState(false);

const normalizeSku = (value: string) => (value ?? "").trim().toLowerCase();

const checkSkuMismatches = async (rows: CSVRow[]) => {
  const uniqueSkus = Array.from(
    new Set(rows.map((r) => normalizeSku(String(r.sku || ""))).filter(Boolean)),
  );

  if (uniqueSkus.length === 0) {
    setSkuMismatchSet(new Set());
    return;
  }

  setCheckingSkus(true);
  const { data, error } = await supabase
    .from("products")
    .select("sku")
    .in("sku", uniqueSkus);

  setCheckingSkus(false);

  if (error) {
    toast.error("Failed to validate SKUs", { description: error.message });
    return;
  }

  const existing = new Set((data ?? []).map((row) => normalizeSku(row.sku || "")));
  const mismatches = new Set(
    uniqueSkus.filter((sku) => !existing.has(sku)),
  );
  setSkuMismatchSet(mismatches);
};

const openImportPreview = async (rows: CSVRow[]) => {
  setPreviewRows(rows);
  setShowImportPreview(true);
  await checkSkuMismatches(rows);
};

3) Change CSVUploader onParsed to open preview (instead of direct import)
<CSVUploader
  onParsed={(rows) => void openImportPreview(rows)}
  onError={(msg) =>
    toast.error("CSV parse failed", { description: msg })
  }
/>

4) Add the preview modal JSX (place near the bottom of the component)
<Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle className="text-[#111827]">
        Import Preview
      </DialogTitle>
      <DialogDescription className="text-[#6B7280]">
        Review parsed rows before submitting. Mismatched SKUs are highlighted in red.
      </DialogDescription>
    </DialogHeader>

    {checkingSkus ? (
      <p className="text-sm text-[#6B7280]">Checking SKUs...</p>
    ) : (
      <div className="space-y-3">
        {skuMismatchSet.size > 0 && (
          <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
            {skuMismatchSet.size} mismatch(es) found. Fix them before submitting.
          </div>
        )}

        <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-2">SKU</th>
                <th className="text-left px-4 py-2">Qty</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => {
                const sku = normalizeSku(String(row.sku || ""));
                const isMismatch = sku && skuMismatchSet.has(sku);
                return (
                  <tr
                    key={`${sku}-${i}`}
                    className={`border-b ${isMismatch ? "bg-[#FEF2F2]" : ""}`}
                  >
                    <td className={`px-4 py-2 ${isMismatch ? "text-[#991B1B]" : "text-[#111827]"}`}>
                      {row.sku || "—"}
                    </td>
                    <td className="px-4 py-2 text-[#111827]">{row.qty ?? "—"}</td>
                    <td className="px-4 py-2">
                      {isMismatch ? (
                        <span className="text-xs font-semibold text-[#991B1B]">Mismatch</span>
                      ) : (
                        <span className="text-xs font-semibold text-[#166534]">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImportPreview(false)}
            className="border-[#111827]/20 text-[#111827]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleImportPO(previewRows)}
            disabled={skuMismatchSet.size > 0}
            className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
          >
            Submit Import
          </Button>
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
END FILE
```

If you want me to tailor the modal styling to match another area of the UI, tell me which screen style to mirror.