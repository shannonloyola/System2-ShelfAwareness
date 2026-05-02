/**
 * AsyncStorage helpers for persisting recent scans.
 * Keeps the last 10 successful scans across app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shipment } from '../services/shipmentApi';

const STORAGE_KEY = 'shelfaware_recent_scans';
const MAX_SCANS = 10;

export interface RecentScan {
  id: string;
  trackingNumber: string;
  supplierName?: string;
  receivedAt: string; // ISO string
  status: string;
  itemCount?: number;
}

export const saveRecentScan = async (shipment: Shipment): Promise<void> => {
  try {
    const existing = await getRecentScans();
    const newScan: RecentScan = {
      id: shipment.id,
      trackingNumber: shipment.tracking_number,
      supplierName: shipment.supplier_name,
      receivedAt: new Date().toISOString(),
      status: shipment.status,
      itemCount: shipment.item_count,
    };
    // Remove duplicate if same tracking number already exists, then prepend
    const filtered = existing.filter((s) => s.trackingNumber !== shipment.tracking_number);
    const updated = [newScan, ...filtered].slice(0, MAX_SCANS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    // Non-critical — silently fail storage errors
    console.warn('Failed to save recent scan:', e);
  }
};

export const getRecentScans = async (): Promise<RecentScan[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentScan[];
  } catch {
    return [];
  }
};

export const clearRecentScans = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};
