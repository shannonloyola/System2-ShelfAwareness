/**
 * In-memory fallback storage for recent scans.
 * Bypasses problematic AsyncStorage modules while maintaining session-based history.
 */

const MAX_SCANS = 10;
let memoryCache: RecentScan[] = [];

export interface RecentScan {
  id: string;
  trackingNumber: string;
  supplierName?: string;
  receivedAt: string; // ISO string
  status: string;
  itemCount?: number;
}

export const saveRecentScan = async (shipment: any): Promise<void> => {
  try {
    const newScan: RecentScan = {
      id: shipment.id || shipment.shipment_id,
      trackingNumber: shipment.tracking_number || shipment.shipment_id,
      supplierName: shipment.supplier_name,
      receivedAt: new Date().toISOString(),
      status: shipment.status,
      itemCount: shipment.item_count,
    };

    // Prepend and limit
    const filtered = memoryCache.filter((s) => s.id !== newScan.id);
    memoryCache = [newScan, ...filtered].slice(0, MAX_SCANS);

    console.log('[MEMORY_STORAGE] Saved successfully:', newScan.id);
  } catch (e) {
    console.error('[MEMORY_STORAGE] Save Error:', e);
  }
};

export const getRecentScans = async (): Promise<RecentScan[]> => {
  return [...memoryCache];
};

export const clearRecentScans = async (): Promise<void> => {
  memoryCache = [];
};
