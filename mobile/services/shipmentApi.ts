/**
 * Shipment API service for the ShelfAwareness mobile app.
 * Connects to the warehouse-receiving-service.
 */
import { Platform } from 'react-native';
import { API_CONFIG } from '../config';

// Using your PC's active IP address
const BASE_URL = API_CONFIG.WAREHOUSE_RECEIVING_URL; 

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
  po_no?: string;
  expected_items?: any[];
}

export interface ShipmentStats {
  receivedToday: number;
}

/**
 * Base fetch helper
 */
async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Request failed: ${response.status}`);
  }

  const json = await response.json();
  return json.data ?? json;
}

export const getShipmentByTracking = async (trackingNumber: string): Promise<Shipment | null> => {
  return fetchApi(`/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`, {
    method: 'GET',
  });
};

export const getPendingShipments = async (): Promise<Shipment[]> => {
  const data = await fetchApi('/shipments/pending', { method: 'GET' });
  return Array.isArray(data) ? data : [];
};

export const getTodayStats = async (): Promise<ShipmentStats> => {
  const data = await fetchApi('/shipments/stats/today', { method: 'GET' });
  return { receivedToday: data?.receivedToday ?? 0 };
};

export const markAsReceived = async (
  id: string,
  receivedBy?: string,
  notes?: string,
): Promise<Shipment> => {
  const data = await fetchApi(`/shipments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'received', receivedBy, notes }),
  });
  if (!data) throw new Error('No response from server');
  return data;
};
