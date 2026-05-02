/**
 * Shipment API service for the ShelfAwareness mobile app.
 * Connects to the warehouse-receiving-service on port 4005.
 */
import { Platform } from 'react-native';

// On Android emulator, localhost = 10.0.2.2
// On physical device or iOS, use the actual host IP / env var
const BASE_URL =
  (process.env.EXPO_PUBLIC_WAREHOUSE_URL as string | undefined) ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4005' : 'http://localhost:4005');

export interface Shipment {
  id: string;
  tracking_number: string;
  supplier_name?: string;
  status: 'pending' | 'received' | 'cancelled' | string;
  expected_arrival?: string;
  received_at?: string;
  received_by?: string;
  notes?: string;
  item_count?: number;
  po_number?: string;
}

export interface ShipmentStats {
  receivedToday: number;
}

const handleResponse = async (res: Response) => {
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed: ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
};

export const getShipmentByTracking = async (trackingNumber: string): Promise<Shipment | null> => {
  const res = await fetch(
    `${BASE_URL}/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } },
  );
  return handleResponse(res);
};

export const getPendingShipments = async (): Promise<Shipment[]> => {
  const res = await fetch(`${BASE_URL}/shipments/pending`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(res);
  return Array.isArray(data) ? data : [];
};

export const getTodayStats = async (): Promise<ShipmentStats> => {
  const res = await fetch(`${BASE_URL}/shipments/stats/today`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await handleResponse(res);
  return { receivedToday: data?.receivedToday ?? 0 };
};

export const markAsReceived = async (
  id: string,
  receivedBy?: string,
  notes?: string,
): Promise<Shipment> => {
  const res = await fetch(`${BASE_URL}/shipments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'received', receivedBy, notes }),
  });
  const data = await handleResponse(res);
  if (!data) throw new Error('No response from server');
  return data;
};
