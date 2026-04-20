import { useState, useEffect, useCallback } from "react";
import {
  ScanBarcode,
  CheckCircle,
  Package,
  Plus,
  Trash2,
  SendHorizonal,
  RefreshCw,
  Truck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { postGRN } from "/utils/supabase/postGRN";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  batch: string;
  systemCount: number;
  status: "normal" | "low" | "zero";
  expiry: string;
}

interface GrnLine {
  lineId: string;
  productId: string;
  qtyExpected: string;
  qtyReceived: string;
  discrepancyReason: string;
  otherReason: string;
}

const PRODUCT_CATALOG = [
  { id: "39", sku: "MED-003", name: "Amoxicillin 500mg",    batch: "#9902", expiry: "2026-12-31" },
  { id: "37", sku: "MED-001", name: "Paracetamol 500mg",    batch: "#9903", expiry: "2027-03-15" },
  { id: "40", sku: "MED-004", name: "Cetirizine 10mg",      batch: "#9904", expiry: "2026-08-20" },
  { id: "41", sku: "MED-005", name: "Loperamide 2mg",       batch: "#9905", expiry: "2026-11-10" },
  { id: "38", sku: "MED-002", name: "Ibuprofen 200mg",      batch: "#9906", expiry: "2027-01-25" },
  { id: "42", sku: "VIT-001", name: "Vitamin C 500mg",      batch: "#9907", expiry: "2027-06-01" },
  { id: "43", sku: "VIT-002", name: "Vitamin D3 1000IU",    batch: "#9908", expiry: "2027-06-01" },
  { id: "44", sku: "VIT-003", name: "Multivitamins + Iron", batch: "#9909", expiry: "2027-06-01" },
  { id: "45", sku: "VIT-004", name: "Calcium + Magnesium",  batch: "#9910", expiry: "2027-06-01" },
  { id: "46", sku: "VIT-005", name: "Fish Oil 1000mg",      batch: "#9911", expiry: "2027-06-01" },
];

const MIN_STOCK_THRESHOLD = 500;

const createEmptyLine = (): GrnLine => ({
  lineId: crypto.randomUUID(),
  productId: "",
  qtyExpected: "",
  qtyReceived: "",
  discrepancyReason: "",
  otherReason: "",
});

export function WarehouseReceiving() {
  const [showGrnForm, setShowGrnForm] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GrnLine[]>([createEmptyLine()]);
  const [lastScannedItem, setLastScannedItem] = useState<{ id: string; name: string; systemCount: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [savedGrnId, setSavedGrnId] = useState<string | null>(null);
  const [savedGrnNumber, setSavedGrnNumber] = useState<string | null>(null);
  const [isPosted, setIsPosted] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Delivery scheduling state
  const [showDeliveryScheduleDialog, setShowDeliveryScheduleDialog] = useState(false);
  const [schedulingDelivery, setSchedulingDelivery] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    shipment_id: "",
    expected_delivery_date: "",
    expected_delivery_time: "",
    warehouse_location: "",
    contact_person: "",
    contact_phone: "",
    notes: "",
  });

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const baseUrl = `https://${projectId}.supabase.co/rest/v1`;
      const headers = { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}` };

      const iohRes = await fetch(`${baseUrl}/inventory_on_hand?select=product_id,qty_on_hand`, { headers });
      if (!iohRes.ok) throw new Error(`inventory_on_hand: ${iohRes.status} ${await iohRes.text()}`);
      const onHand: { product_id: string; qty_on_hand: number }[] = await iohRes.json();

      const productIds = PRODUCT_CATALOG.map((p) => p.id).join(",");
      const prodRes = await fetch(
        `${baseUrl}/products?select=product_id,product_uuid,sku,product_name&product_id=in.(${productIds})`,
        { headers },
      );
      if (!prodRes.ok) throw new Error(`products: ${prodRes.status} ${await prodRes.text()}`);
      const products: any[] = await prodRes.json();

      const catalogMap = Object.fromEntries(PRODUCT_CATALOG.map((p) => [p.id, p]));

      const items: InventoryItem[] = products.map((p) => {
        const ioh = onHand.find((o) => o.product_id === p.product_uuid);
        const qty = ioh?.qty_on_hand ?? 0;
        const catalog = catalogMap[String(p.product_id)];
        const status: InventoryItem["status"] = qty === 0 ? "zero" : qty < MIN_STOCK_THRESHOLD ? "low" : "normal";
        return {
          id: String(p.product_id),
          sku: p.sku,
          name: p.product_name,
          batch: catalog?.batch ?? "—",
          systemCount: qty,
          status,
          expiry: catalog?.expiry ?? "—",
        };
      });

      setInventory(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("fetchInventory error:", msg);
      toast.error("Could not load inventory", { description: msg });
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const insertScannedItemToLines = (item: { id: string; name: string; systemCount: number }) => {
    setLines((prev) => {
      if (prev.length === 1 && !prev[0].productId) {
        return [{ ...prev[0], productId: item.id, qtyExpected: item.systemCount.toString() }];
      }
      return [...prev, { lineId: crypto.randomUUID(), productId: item.id, qtyExpected: item.systemCount.toString(), qtyReceived: "", discrepancyReason: "", otherReason: "" }];
    });
  };

  const handleScan = () => {
    const randomCatalog = PRODUCT_CATALOG[Math.floor(Math.random() * PRODUCT_CATALOG.length)];
    const inv = inventory.find((i) => i.id === randomCatalog.id);
    const scanned = { id: randomCatalog.id, name: randomCatalog.name, systemCount: inv?.systemCount ?? 0 };
    setLastScannedItem(scanned);
    if (showGrnForm) {
      insertScannedItemToLines(scanned);
      toast.success("Barcode Scanned", { description: `${randomCatalog.name} added to GRN line items` });
      return;
    }
    toast.success("Barcode Scanned", { description: `${randomCatalog.name} scanned. Click View GRN to continue.` });
  };

  const handleViewGrn = () => {
    setShowGrnForm(true);
    if (lastScannedItem) { insertScannedItemToLines(lastScannedItem); setLastScannedItem(null); }
  };

  const addLine = () => setLines((prev) => [...prev, createEmptyLine()]);
  const removeLine = (lineId: string) => {
    // Editing lines after save invalidates the saved draft — reset it so
    // handlePostGrn will write a fresh draft with the correct data.
    setSavedGrnId(null);
    setSavedGrnNumber(null);
    setLines((prev) => prev.length === 1 ? prev : prev.filter((l) => l.lineId !== lineId));
  };
  const updateLine = (lineId: string, field: keyof GrnLine, value: string) => {
    // Any edit after save means the saved draft is stale — force a re-save on post.
    setSavedGrnId(null);
    setSavedGrnNumber(null);
    setLines((prev) => prev.map((l) => l.lineId === lineId ? { ...l, [field]: value } : l));
  };

  const validateLines = (): boolean => {
    if (!receivedDate) { toast.error("Missing received date"); return false; }

    // RPC requires at least one line
    if (lines.length === 0 || (lines.length === 1 && !lines[0].productId)) {
      toast.error("At least one line item is required");
      return false;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);

      if (!line.productId) { toast.error(`Line ${i + 1}: Product is required`); return false; }
      if (line.qtyExpected === "" || !Number.isFinite(expected) || expected < 0) {
        toast.error(`Line ${i + 1}: Qty expected must be 0 or higher`); return false;
      }
      // RPC skips lines where qty_received = 0, so require at least 1
      if (line.qtyReceived === "" || !Number.isFinite(received) || received < 1) {
        toast.error(`Line ${i + 1}: Qty received must be 1 or higher`); return false;
      }

      const mismatch = expected !== received;
      if (mismatch && !line.discrepancyReason) {
        toast.error(`Line ${i + 1}: Discrepancy reason is required`); return false;
      }
      if (mismatch && line.discrepancyReason === "other" && !line.otherReason.trim()) {
        toast.error(`Line ${i + 1}: Please type Other reason`); return false;
      }
    }
    return true;
  };

  const buildPayloads = () => {
    const grnId = crypto.randomUUID();
    const dateStamp = receivedDate.replace(/-/g, "");
    const timeStamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
    const grnNumber = `GRN-${dateStamp}-${timeStamp}`;

    const headerPayload = {
      id: grnId,
      grn_number: grnNumber,
      received_date: receivedDate,
      notes: notes.trim() || null,
      status: "DRAFT",
      created_by: "warehouse_operator",
    };

    const linePayload = lines.map((line, idx) => {
      const product = PRODUCT_CATALOG.find((item) => item.id === line.productId);
      const expected = Number(line.qtyExpected);
      const received = Number(line.qtyReceived);
      const mismatch = expected !== received;
      // Resolve "other" to the typed free-text value before saving to DB
      const reason = mismatch
        ? (line.discrepancyReason === "other" ? line.otherReason.trim() : line.discrepancyReason)
        : null;
      return {
        id: crypto.randomUUID(),
        grn_draft_id: grnId,
        line_no: idx + 1,
        product_id: line.productId,          // text column storing integer product_id
        product_name: product?.name ?? "Unknown",
        sku: product?.sku ?? "N/A",
        qty_expected: expected,
        qty_received: received,
        variance: received - expected,
        discrepancy_reason: reason,
      };
    });

    return { grnId, grnNumber, headerPayload, linePayload };
  };

  const saveToDatabase = async (headerPayload: object, linePayload: object[]) => {
    const hRes = await fetch(`https://${projectId}.supabase.co/rest/v1/grn_drafts`, {
      method: "POST",
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(headerPayload),
    });
    if (!hRes.ok) throw new Error(await hRes.text());

    const lRes = await fetch(`https://${projectId}.supabase.co/rest/v1/grn_draft_lines`, {
      method: "POST",
      headers: {
        apikey: publicAnonKey,
        Authorization: `Bearer ${publicAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(linePayload),
    });
    if (!lRes.ok) throw new Error(await lRes.text());
  };

  const handleSaveGrn = async () => {
    if (!validateLines()) return;
    const { grnId, grnNumber, headerPayload, linePayload } = buildPayloads();
    setIsSaving(true);
    try {
      await saveToDatabase(headerPayload, linePayload);
      setSavedGrnId(grnId);
      setSavedGrnNumber(grnNumber);
      setIsPosted(false);
      toast.success(`GRN ${grnNumber} saved`, { description: `${linePayload.length} line item(s) recorded` });
    } catch (error) {
      toast.error("Save failed", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostGrn = async () => {
    if (!validateLines()) return;
    setIsPosting(true);
    try {
      let grnId = savedGrnId;
      let grnNumber = savedGrnNumber;

      // Always write a fresh draft if there's no saved ID (first post or lines
      // were edited after the last save, which clears savedGrnId).
      if (!grnId) {
        const p = buildPayloads();
        grnId = p.grnId;
        grnNumber = p.grnNumber;
        await saveToDatabase(p.headerPayload, p.linePayload);
      }

      // Call the RPC — post_grn_draft handles inventory_on_hand + inventory_movements
      const result = await postGRN(grnId!, "warehouse_operator");

      setIsPosted(true);
      setSavedGrnId(grnId);
      setSavedGrnNumber(grnNumber);

      toast.success(`GRN ${grnNumber} posted!`, {
        description: `${result.lines_processed} line(s) · ${result.products_updated} product(s) updated`,
      });

      // Refresh stock display after a short delay so the DB write settles
      await new Promise((r) => setTimeout(r, 600));
      await fetchInventory();

      // Reset the form after giving the user time to see the success state
      setTimeout(() => {
        setReceivedDate(new Date().toISOString().split("T")[0]);
        setNotes("");
        setLines([createEmptyLine()]);
        setShowGrnForm(false);
        setSavedGrnId(null);
        setSavedGrnNumber(null);
        setIsPosted(false);
      }, 2500);
    } catch (error) {
      console.error("handlePostGrn error:", error);
      toast.error("Post failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleScheduleDelivery = useCallback(async () => {
    // Validation
    if (!deliveryForm.shipment_id.trim()) {
      toast.error("Validation Error", { description: "Shipment ID is required" });
      return;
    }
    if (!deliveryForm.expected_delivery_date) {
      toast.error("Validation Error", { description: "Expected delivery date is required" });
      return;
    }
    if (!deliveryForm.warehouse_location.trim()) {
      toast.error("Validation Error", { description: "Warehouse location is required" });
      return;
    }
    if (!deliveryForm.contact_person.trim()) {
      toast.error("Validation Error", { description: "Contact person is required" });
      return;
    }

    setSchedulingDelivery(true);
    try {
      const baseUrl = `https://${projectId}.supabase.co/functions/v1`;
      const response = await fetch(`${baseUrl}/shipments/delivery-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          shipment_id: deliveryForm.shipment_id.trim(),
          expected_delivery_date: deliveryForm.expected_delivery_date,
          expected_delivery_time: deliveryForm.expected_delivery_time || null,
          warehouse_location: deliveryForm.warehouse_location.trim(),
          contact_person: deliveryForm.contact_person.trim(),
          contact_phone: deliveryForm.contact_phone.trim() || null,
          notes: deliveryForm.notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Success
      toast.success("Delivery scheduled successfully", {
        description: "The warehouse is now expecting this delivery.",
      });

      // Reset form and close dialog
      setDeliveryForm({
        shipment_id: "",
        expected_delivery_date: "",
        expected_delivery_time: "",
        warehouse_location: "",
        contact_person: "",
        contact_phone: "",
        notes: "",
      });
      setShowDeliveryScheduleDialog(false);
    } catch (error) {
      console.error("Delivery scheduling error:", error);
      toast.error("Failed to schedule delivery", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSchedulingDelivery(false);
    }
  }, [deliveryForm, projectId, publicAnonKey]);

  return (
    <div className="p-4 space-y-6 bg-white pb-24 lg:pb-8">
      <div>
        <h1 className="text-2xl lg:text-4xl font-semibold mb-2 text-[#111827]">Warehouse Receiving & GRN</h1>
        <p className="text-sm lg:text-base text-[#6B7280]">Scan barcode and process GRN lines</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button onClick={handleScan} className="h-20 bg-[#00A3AD] hover:bg-[#0891B2] text-white flex flex-col gap-2 shadow-md">
          <ScanBarcode className="w-8 h-8" />
          <span className="font-semibold">Scan Barcode</span>
        </Button>
        <Button onClick={handleViewGrn} variant="outline" className="h-20 border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 flex flex-col gap-2">
          <Package className="w-8 h-8" />
          <span className="font-semibold">View GRN</span>
        </Button>
        <Button onClick={() => setShowDeliveryScheduleDialog(true)} variant="outline" className="h-20 border-[#059669] text-[#059669] hover:bg-[#059669]/10 flex flex-col gap-2">
          <Truck className="w-8 h-8" />
          <span className="font-semibold">Schedule Delivery</span>
        </Button>
      </div>

      {showGrnForm && (
        <>
          <Card className="bg-white border-[#111827]/10 shadow-lg">
            <CardHeader><CardTitle className="text-[#111827] font-semibold">GRN Header</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#6B7280]">Received Date</Label>
                <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="mt-2 border-[#111827]/10" disabled={isPosted} />
              </div>
              <div>
                <Label className="text-[#6B7280]">Notes (Optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Supplier delivery note, issue summary, etc." className="mt-2 border-[#111827]/10" disabled={isPosted} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#111827]/10 shadow-lg">
            <CardHeader><CardTitle className="text-[#111827] font-semibold">Line Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {lines.map((line, index) => {
                const expected = Number(line.qtyExpected);
                const received = Number(line.qtyReceived);
                const mismatch =
                  Number.isFinite(expected) &&
                  Number.isFinite(received) &&
                  line.qtyExpected !== "" &&
                  line.qtyReceived !== "" &&
                  expected !== received;
                return (
                  <div key={line.lineId} className="border border-[#E5E7EB] rounded-lg p-4 space-y-4 bg-[#F8FAFC]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#111827]">Line {index + 1}</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
                        onClick={() => removeLine(line.lineId)}
                        disabled={lines.length === 1 || isPosted}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#6B7280]">Product</Label>
                        <Select value={line.productId} onValueChange={(v) => updateLine(line.lineId, "productId", v)} disabled={isPosted}>
                          <SelectTrigger className="mt-2 border-[#111827]/10 bg-white"><SelectValue placeholder="Select product" /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_CATALOG.map((item) => (
                              <SelectItem key={item.id} value={item.id}>{item.name} ({item.sku})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">Qty Expected</Label>
                        <Input type="number" min="0" value={line.qtyExpected} onChange={(e) => updateLine(line.lineId, "qtyExpected", e.target.value)} className="mt-2 border-[#111827]/10 bg-white" placeholder="0" disabled={isPosted} />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">Qty Received</Label>
                        <Input type="number" min="1" value={line.qtyReceived} onChange={(e) => updateLine(line.lineId, "qtyReceived", e.target.value)} className="mt-2 border-[#111827]/10 bg-white" placeholder="0" disabled={isPosted} />
                      </div>
                      <div>
                        <Label className="text-[#6B7280]">Discrepancy Reason {mismatch ? "(Required)" : "(Optional)"}</Label>
                        <Select value={line.discrepancyReason} onValueChange={(v) => updateLine(line.lineId, "discrepancyReason", v)} disabled={isPosted}>
                          <SelectTrigger className="mt-2 border-[#111827]/10 bg-white"><SelectValue placeholder="Select reason" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="damaged">Damaged in Transit</SelectItem>
                            <SelectItem value="shortage">Supplier Shortage</SelectItem>
                            <SelectItem value="count_error">Count Error</SelectItem>
                            <SelectItem value="expired">Expired Items</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {mismatch && line.discrepancyReason === "other" && (
                      <div>
                        <Label className="text-[#6B7280]">Type Other Reason</Label>
                        <Input value={line.otherReason} onChange={(e) => updateLine(line.lineId, "otherReason", e.target.value)} className="mt-2 border-[#111827]/10 bg-white" placeholder="Enter reason" disabled={isPosted} />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button onClick={addLine} variant="outline" className="w-full border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10" disabled={isPosted}>
                <Plus className="w-4 h-4 mr-2" />Add Line Item
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Live Stock-on-Hand */}
      <Card className="bg-white border-[#111827]/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[#111827] font-semibold">Stock-on-Hand</CardTitle>
              <p className="text-sm text-[#6B7280]">Current inventory levels</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchInventory} disabled={loadingInventory} className="border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10">
              <RefreshCw className={`w-4 h-4 mr-1 ${loadingInventory ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingInventory && inventory.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-4">Loading inventory...</p>
          ) : inventory.length === 0 ? (
            <p className="text-sm text-[#6B7280] text-center py-4">No inventory data found.</p>
          ) : (
            inventory.map((item) => (
              <div key={item.id} className={`p-4 rounded-lg border-2 transition-all ${item.status === "zero" || item.status === "low" ? "border-[#F97316] bg-[#F97316]/5 shadow-sm" : "border-[#E5E7EB] hover:border-[#00A3AD]"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-[#111827] mb-1">{item.name}</div>
                    <div className="text-sm text-[#6B7280]">SKU: {item.sku} | Batch: {item.batch}</div>
                  </div>
                  {(item.status === "zero" || item.status === "low") && (
                    <span className="px-3 py-1 bg-[#F97316] text-white text-xs rounded-full whitespace-nowrap font-medium">
                      {item.status === "zero" ? "Out of Stock" : "Restock"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold" style={{ color: item.status === "zero" ? "#F97316" : "#111827" }}>
                    {item.systemCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-[#6B7280] font-medium">Exp: {item.expiry}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {showGrnForm && (
        <div className="sticky bottom-0 z-10 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-2xl mx-auto space-y-2">
            {isPosted ? (
              <div className="w-full h-14 flex items-center justify-center gap-2 rounded-md bg-green-50 border border-green-300 text-green-700 font-semibold">
                <CheckCircle className="w-5 h-5" />
                Posted — {savedGrnNumber}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={handleSaveGrn} disabled={isSaving || isPosting} variant="outline" className="h-14 border-[#00A3AD] text-[#00A3AD] hover:bg-[#00A3AD]/10 font-semibold disabled:opacity-50">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {isSaving ? "Saving..." : "Save GRN"}
                </Button>
                <Button onClick={handlePostGrn} disabled={isSaving || isPosting} className="h-14 bg-[#059669] hover:bg-[#047857] text-white shadow-lg font-semibold disabled:opacity-50">
                  <SendHorizonal className="w-5 h-5 mr-2" />
                  {isPosting ? "Posting..." : "Post GRN"}
                </Button>
                <Button onClick={() => setShowDeliveryScheduleDialog(true)} variant="outline" className="h-14 border-[#059669] text-[#059669] hover:bg-[#059669]/10 font-semibold">
                  <Truck className="w-5 h-5 mr-2" />
                  Schedule Delivery
                </Button>
              </div>
            )}
            {!isPosted && savedGrnId && (
              <p className="text-xs text-center text-[#6B7280]">
                GRN saved as draft — click <strong>Post GRN</strong> to update inventory
              </p>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Delivery Scheduling Dialog */}
    <Dialog open={showDeliveryScheduleDialog} onOpenChange={setShowDeliveryScheduleDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#111827] flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Schedule Delivery
          </DialogTitle>
          <DialogDescription className="text-[#6B7280]">
            Notify logistics coordinators that the warehouse is expecting a delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[#6B7280]">Shipment ID *</Label>
            <Input
              value={deliveryForm.shipment_id}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, shipment_id: e.target.value })}
              placeholder="Enter shipment ID"
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div>
            <Label className="text-[#6B7280]">Expected Delivery Date *</Label>
            <Input
              type="date"
              value={deliveryForm.expected_delivery_date}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, expected_delivery_date: e.target.value })}
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div>
            <Label className="text-[#6B7280]">Expected Delivery Time</Label>
            <Input
              type="time"
              value={deliveryForm.expected_delivery_time}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, expected_delivery_time: e.target.value })}
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div>
            <Label className="text-[#6B7280]">Warehouse Location *</Label>
            <Select
              value={deliveryForm.warehouse_location}
              onValueChange={(value) => setDeliveryForm({ ...deliveryForm, warehouse_location: value })}
              disabled={schedulingDelivery}
            >
              <SelectTrigger className="mt-2 border-[#111827]/10">
                <SelectValue placeholder="Select warehouse location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Zone A-01">Zone A-01</SelectItem>
                <SelectItem value="Zone A-02">Zone A-02</SelectItem>
                <SelectItem value="Zone B-01">Zone B-01</SelectItem>
                <SelectItem value="Zone B-02">Zone B-02</SelectItem>
                <SelectItem value="Zone C-01">Zone C-01</SelectItem>
                <SelectItem value="Zone C-02">Zone C-02</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[#6B7280]">Contact Person *</Label>
            <Input
              value={deliveryForm.contact_person}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, contact_person: e.target.value })}
              placeholder="Enter contact person name"
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div>
            <Label className="text-[#6B7280]">Contact Phone</Label>
            <Input
              value={deliveryForm.contact_phone}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, contact_phone: e.target.value })}
              placeholder="Enter contact phone number"
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div>
            <Label className="text-[#6B7280]">Notes</Label>
            <Input
              value={deliveryForm.notes}
              onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
              placeholder="Additional notes (optional)"
              className="mt-2 border-[#111827]/10"
              disabled={schedulingDelivery}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeliveryScheduleDialog(false)}
              className="border-[#111827]/20 text-[#111827]"
              disabled={schedulingDelivery}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScheduleDelivery}
              className="bg-[#059669] hover:bg-[#047857] text-white"
              disabled={schedulingDelivery}
            >
              {schedulingDelivery ? "Scheduling..." : "Schedule Delivery"}
            </Button>
          </div>
        </div>
      </Dialog>
  );
}