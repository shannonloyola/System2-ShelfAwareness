BEGIN FILE: prompt.txt
INSTRUCTIONS FOR FIGMA AI:
- You are designing a UI update, not writing code.
- Use the code below only to understand layout and required fields. Do NOT render the code.
- Inside the “View GRN” modal, add a new sub‑form titled “Pharma Checks”.
- The sub‑form has radio buttons (Pass / Fail / N/A) for each check.
- Include a text notes field with a clear placeholder (e.g., “Enter notes (optional)”).
- Include a file upload for a photo/scan proof.
- Add a “Save Checks” button inside the GRN modal.
- Keep styles consistent with the existing GRN modal.

CODE (apply in src/app/components/screens/WarehouseReceiving.tsx):

1) Add imports
import {
  RadioGroup,
  RadioGroupItem,
} from "../ui/radio-group";

2) Add state inside WarehouseReceiving()
const [grnCheckPhoto, setGrnCheckPhoto] = useState<File | null>(null);
const [grnCheckNotes, setGrnCheckNotes] = useState("");
const [grnChecks, setGrnChecks] = useState<Record<string, string>>({
  packaging_intact: "",
  correct_label: "",
  temperature_ok: "",
  expiry_ok: "",
});
const [savingGrnChecks, setSavingGrnChecks] = useState(false);

3) Add helper to upload file to Supabase storage
const uploadGrnCheckPhoto = async (grnId: string) => {
  if (!grnCheckPhoto) return null;

  const filePath = `${grnId}/${Date.now()}-${grnCheckPhoto.name}`;
  // Replace bucket name if needed
  const { error: uploadError } = await supabase.storage
    .from("grn-qa-photos")
    .upload(filePath, grnCheckPhoto, { upsert: true });

  if (uploadError) {
    toast.error("Upload failed", { description: uploadError.message });
    return null;
  }

  const { data } = supabase.storage
    .from("grn-qa-photos")
    .getPublicUrl(filePath);

  return data.publicUrl;
};

4) Add save handler
const handleSaveGrnChecks = async (grnId: string) => {
  setSavingGrnChecks(true);

  const photoUrl = await uploadGrnCheckPhoto(grnId);

  // Replace table name/columns if your schema differs
  const { error } = await supabase
    .from("grn_quality_checks")
    .insert({
      grn_id: grnId,
      checks: grnChecks,
      notes: grnCheckNotes || null,
      photo_url: photoUrl,
    });

  setSavingGrnChecks(false);

  if (error) {
    toast.error("Failed to save checks", { description: error.message });
    return;
  }

  toast.success("GRN checks saved");
};

5) Add the sub‑form UI inside the “View GRN” modal content
<div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC] space-y-4">
  <div>
    <h3 className="text-sm font-semibold text-[#111827]">
      Pharma Checks
    </h3>
    <p className="text-xs text-[#6B7280]">
      Complete the checklist and upload proof if needed.
    </p>
  </div>

  {[
    { key: "packaging_intact", label: "Packaging Intact" },
    { key: "correct_label", label: "Correct Labeling" },
    { key: "temperature_ok", label: "Temperature OK" },
    { key: "expiry_ok", label: "Expiry Date Valid" },
  ].map((check) => (
    <div key={check.key} className="space-y-2">
      <Label className="text-sm text-[#111827]">{check.label}</Label>
      <RadioGroup
        value={grnChecks[check.key]}
        onValueChange={(val) =>
          setGrnChecks((prev) => ({ ...prev, [check.key]: val }))
        }
        className="flex gap-6"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="pass" id={`${check.key}-pass`} />
          <Label htmlFor={`${check.key}-pass`}>Pass</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="fail" id={`${check.key}-fail`} />
          <Label htmlFor={`${check.key}-fail`}>Fail</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="na" id={`${check.key}-na`} />
          <Label htmlFor={`${check.key}-na`}>N/A</Label>
        </div>
      </RadioGroup>
    </div>
  ))}

  <div>
    <Label className="text-sm text-[#111827]">Notes</Label>
    <Input
      value={grnCheckNotes}
      onChange={(e) => setGrnCheckNotes(e.target.value)}
      placeholder="Enter notes (optional)"
      className="mt-2 border-[#111827]/10 rounded-lg"
    />
  </div>

  <div>
    <Label className="text-sm text-[#111827]">Upload Photo</Label>
    <Input
      type="file"
      accept="image/*"
      onChange={(e) => setGrnCheckPhoto(e.target.files?.[0] ?? null)}
      className="mt-2 border-[#111827]/10 rounded-lg"
    />
  </div>

  <div className="flex justify-end">
    <Button
      onClick={() => void handleSaveGrnChecks(selectedGrnId)}
      disabled={savingGrnChecks}
      className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
    >
      {savingGrnChecks ? "Saving..." : "Save Checks"}
    </Button>
  </div>
</div>
END FILE
