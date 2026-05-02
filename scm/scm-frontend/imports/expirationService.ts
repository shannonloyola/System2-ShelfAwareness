import { supabase } from "../lib/supabase";

// ── Manually trigger expiration check (calls the Postgres function) ──
export async function runExpirationCheck() {
  const { data, error } = await supabase.rpc(
    "expire_reservations",
  );
  if (error) throw new Error(error.message);
  return data as {
    expired_po_id: string;
    po_no: string;
    released_qty: number;
    product_id: number;
  }[];
}

// ── Reserve stock when a PO is created ──
export async function reserveStock(
  productId: number,
  qty: number,
) {
  const { error } = await supabase.rpc(
    "reserve_product_stock",
    {
      p_product_id: productId,
      p_qty: qty,
    },
  );
  if (error) throw new Error(error.message);
}

// ── Mark PO as paid — clears reservation, confirms stock deduction ──
export async function markPOPaid(poId: string) {
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      status: "Paid",
      paid_at: new Date().toISOString(),
    })
    .eq("po_id", poId);
  if (error) throw new Error(error.message);
}

// ── Fetch all expiring soon (within next 2 hours) ──
export async function fetchExpiringSoon() {
  const twoHoursFromNow = new Date(
    Date.now() + 2 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      "po_id, po_no, supplier_name, status, expires_at, reserved_at",
    )
    .not("status", "in", '("Paid","Expired","Cancelled")')
    .lte("expires_at", twoHoursFromNow)
    .order("expires_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Fetch all currently expired unpaid POs ──
export async function fetchExpiredPOs() {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*")
    .eq("status", "Expired")
    .order("expires_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}