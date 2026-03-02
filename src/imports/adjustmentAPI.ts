import { supabase } from '../lib/supabase';

export type ReasonCategory =
  | 'Damaged Goods'
  | 'Count Correction'
  | 'Theft/Loss'
  | 'Expiry Write-off'
  | 'System Error'
  | 'Other';

export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';

export interface StockAdjustment {
  id: string;
  product_id: number;
  sku: string;
  product_name: string;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  reason: string;
  reason_category: ReasonCategory;
  status: AdjustmentStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_note: string | null;
  created_at: string;
}

export const REASON_CATEGORIES: ReasonCategory[] = [
  'Damaged Goods', 'Count Correction', 'Theft/Loss',
  'Expiry Write-off', 'System Error', 'Other',
];

export async function submitAdjustment(payload: {
  product_id: number; sku: string; product_name: string;
  qty_before: number; qty_change: number; reason: string;
  reason_category: ReasonCategory; requested_by: string;
}) {
  const { data, error } = await supabase
    .from('stock_adjustments')
    .insert([{ ...payload, qty_after: payload.qty_before + payload.qty_change, status: 'pending' }])
    .select().single();
  if (error) throw new Error(error.message);
  return data as StockAdjustment;
}

export async function approveAdjustment(id: string, managerName: string) {
  const { error } = await supabase.rpc('approve_stock_adjustment', {
    p_adjustment_id: id, p_manager_name: managerName,
  });
  if (error) throw new Error(error.message);
}

export async function rejectAdjustment(id: string, managerName: string, note: string) {
  const { error } = await supabase.rpc('reject_stock_adjustment', {
    p_adjustment_id: id, p_manager_name: managerName, p_rejection_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function fetchAdjustments(status?: AdjustmentStatus) {
  let q = supabase.from('stock_adjustments').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as StockAdjustment[];
}