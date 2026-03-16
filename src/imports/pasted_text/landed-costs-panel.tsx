Absolutely — here is **one single copy‑paste block** that contains both the **code** and the **Figma AI instructions**, so you can paste it in one go:

```
INSTRUCTIONS FOR FIGMA AI:
- You are designing a UI update, not writing code.
- Use the code below only to understand layout, data, and button labels. Do NOT render the code.
- Add a new “Logistics Fees & Landed Costs” sub‑panel inside the “View PO” modal.
- Place it under the PO summary and above the status action buttons.
- Panel styling: light gray background, subtle border, rounded corners, same padding and typography as other modal panels.
- Header: title + short helper text about encoding port bills and posting landed costs.
- Top‑right: secondary “Add Fee” button.
- Dynamic rows: fee_type dropdown, amount currency input (₱), and a “Remove” button.
- Primary action: bottom‑right “Post Landed Costs”.
- Status guard: if already posted, inputs are disabled/read‑only and show a red notice:
  “Landed costs already posted. Inputs are read‑only to prevent double‑counting.”

CODE (do not render in UI, context only):

// Add imports
import { useForm, useFieldArray, Controller } from "react-hook-form";

// Inside InboundProcurement()
const [postingLandedCosts, setPostingLandedCosts] = useState(false);

// Adjust this field to your schema (example: landed_costs_posted_at)
const landedCostsPosted = Boolean(
  (selectedPO as any)?.landed_costs_posted_at ||
  (selectedPO as any)?.landed_costs_posted
);

const formatCurrency = (value: string) => {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!numeric) return "";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(numeric);
};

const parseCurrency = (value: string) =>
  Number(value.replace(/[^0-9.]/g, "")) || 0;

const { control, handleSubmit } = useForm({
  defaultValues: {
    fees: [{ fee_type: "", amount: "" }],
  },
});

const { fields, append, remove } = useFieldArray({
  control,
  name: "fees",
});

const handlePostLandedCosts = async (values: {
  fees: { fee_type: string; amount: string }[];
}) => {
  if (!selectedPO?.po_id) return;
  if (landedCostsPosted) return;

  setPostingLandedCosts(true);
  try {
    const payload = {
      po_id: selectedPO.po_id,
      fees: values.fees.map((f) => ({
        fee_type: f.fee_type,
        amount: parseCurrency(f.amount),
      })),
    };

    // Replace RPC name + args with your actual T2 RPC signature
    const { error } = await supabase.rpc(
      "t2_post_landed_costs",
      { p_payload: payload }
    );

    if (error) {
      toast.error("Failed to post landed costs", {
        description: toErrorMessage(error),
      });
      return;
    }

    toast.success("Landed costs posted successfully");
  } finally {
    setPostingLandedCosts(false);
  }
};

// JSX panel (place in View PO modal)
<div className="rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC] space-y-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h3 className="text-sm font-semibold text-[#111827]">
        Logistics Fees & Landed Costs
      </h3>
      <p className="text-xs text-[#6B7280]">
        Encode port bills and post landed costs to trigger the T2 distribution algorithm.
      </p>
    </div>
    <Button
      type="button"
      variant="outline"
      onClick={() => append({ fee_type: "", amount: "" })}
      disabled={landedCostsPosted}
      className="border-[#111827]/20 text-[#111827]"
    >
      Add Fee
    </Button>
  </div>

  {landedCostsPosted && (
    <div className="text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-3 py-2">
      Landed costs already posted. Inputs are read-only to prevent double-counting.
    </div>
  )}

  <div className="space-y-2">
    {fields.map((field, index) => (
      <div
        key={field.id}
        className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"
      >
        <Controller
          control={control}
          name={`fees.${index}.fee_type`}
          render={({ field: feeField }) => (
            <Select
              value={feeField.value || ""}
              onValueChange={feeField.onChange}
              disabled={landedCostsPosted}
            >
              <SelectTrigger className="border-[#111827]/10 rounded-lg">
                <SelectValue placeholder="Select fee type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customs">Customs Duty</SelectItem>
                <SelectItem value="brokerage">Brokerage</SelectItem>
                <SelectItem value="arrastre">Arrastre</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="trucking">Trucking</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          )}
        />

        <Controller
          control={control}
          name={`fees.${index}.amount`}
          render={({ field: amountField }) => (
            <Input
              {...amountField}
              inputMode="decimal"
              placeholder="₱0.00"
              onBlur={(e) =>
                amountField.onChange(formatCurrency(e.target.value))
              }
              onChange={(e) => amountField.onChange(e.target.value)}
              readOnly={landedCostsPosted}
              className="border-[#111827]/10 rounded-lg"
            />
          )}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => remove(index)}
          disabled={landedCostsPosted}
          className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
        >
          Remove
        </Button>
      </div>
    ))}
  </div>

  <div className="flex justify-end">
    <Button
      type="button"
      onClick={handleSubmit(handlePostLandedCosts)}
      disabled={landedCostsPosted || postingLandedCosts}
      className="bg-[#00A3AD] hover:bg-[#0891B2] text-white"
    >
      {postingLandedCosts ? "Posting..." : "Post Landed Costs"}
    </Button>
  </div>
</div>
```