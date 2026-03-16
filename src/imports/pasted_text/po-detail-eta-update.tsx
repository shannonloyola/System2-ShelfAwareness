Update file: Pharmadistributionmanagementsystem-main/src/app/components/screens/POlist.tsx
Component: PODetailPage (View PO screen)

A) ADD IMPORTS (near top with other UI imports)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";

B) ADD STATE (inside PODetailPage, near other useState)
const [editEtaOpen, setEditEtaOpen] = useState(false);
const [etaDraft, setEtaDraft] = useState("");
const [etaReason, setEtaReason] = useState("");
const [savingEta, setSavingEta] = useState(false);

C) ADD SAVE HANDLER (inside PODetailPage)
const saveEta = async () => {
  if (!po) return;
  if (!etaDraft || !etaReason.trim()) {
    toast.error("Date and reason are required");
    return;
  }
  setSavingEta(true);

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({ expected_delivery_date: etaDraft })
    .eq("po_id", po.po_id);

  if (updateError) {
    setSavingEta(false);
    toast.error("Failed to update ETA");
    return;
  }

  await supabase.from("po_status_history").insert({
    po_id: po.po_id,
    status_name: "ETA Updated",
    changed_at: new Date().toISOString(),
    reason: etaReason
  });

  setSavingEta(false);
  setEditEtaOpen(false);
  toast.success("ETA updated");
};

D) REPLACE Expected Delivery block inside the PO header card
Replace the block showing “Expected Delivery” with this:

<div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB]">
  <div className="flex items-center gap-3">
    <Clock className="w-5 h-5 text-[#00A3AD] shrink-0" />
    <div>
      <p className="text-xs text-[#6B7280]">Expected Delivery</p>
      <p className="text-sm font-semibold text-[#111827]">
        {formatDateOnly(po.expected_delivery_date)}
      </p>
    </div>
  </div>
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setEtaDraft(po.expected_delivery_date ?? "");
      setEtaReason("");
      setEditEtaOpen(true);
    }}
    className="border-[#111827]/20 text-[#111827]"
  >
    Edit ETA
  </Button>
</div>

E) ADD MODAL JSX (near end of PODetailPage return)
<Dialog open={editEtaOpen} onOpenChange={setEditEtaOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Edit Expected Delivery</DialogTitle>
    </DialogHeader>

    <Label>New Expected Delivery Date</Label>
    <Input
      type="date"
      value={etaDraft}
      onChange={(e) => setEtaDraft(e.target.value)}
    />

    <Label className="mt-3">Reason for Change</Label>
    <Textarea
      value={etaReason}
      onChange={(e) => setEtaReason(e.target.value)}
      placeholder="Required for audit trail..."
    />

    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" onClick={() => setEditEtaOpen(false)}>
        Cancel
      </Button>
      <Button
        onClick={saveEta}
        disabled={!etaDraft || !etaReason.trim() || savingEta}
      >
        {savingEta ? "Saving..." : "Save ETA"}
      </Button>
    </div>
  </DialogContent>
</Dialog>
