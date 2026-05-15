import {
  fetchExpiredReservations,
  fetchExpiringReservations,
  runReservationExpiration,
  updatePurchaseOrder,
} from "@/lib/procurementService";

export async function runExpirationCheck() {
  return runReservationExpiration();
}

export async function reserveStock(
  _productId: number,
  _qty: number,
) {
  throw new Error(
    "reserveStock is not available from the frontend. Route this through a backend inventory workflow.",
  );
}

export async function markPOPaid(poId: string) {
  return updatePurchaseOrder(poId, {
    status: "Paid",
    paid_at: new Date().toISOString(),
  });
}

export async function fetchExpiringSoon() {
  return fetchExpiringReservations();
}

export async function fetchExpiredPOs() {
  return fetchExpiredReservations();
}
