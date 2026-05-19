import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://havcomxzpyywdqtpgcgr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhdmNvbXh6cHl5d2RxdHBnY2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NjkxMzYsImV4cCI6MjA5NDA0NTEzNn0.B7t9VW5kD7adMQDfW9XvrdgVuYTjEDBvpAhFsBtTuKk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type AppRole = 
  | 'owner_president'
  | 'finance_manager'
  | 'procurement_manager'
  | 'logistics_coordinator'
  | 'warehouse_manager'
  | 'qc_inspector'
  | 'sales_processor'
  | 'delivery_person'
  | 'b2b_customer'
  | 'supplier';

// Roles that are allowed to use the mobile app
export const MOBILE_ALLOWED_ROLES: AppRole[] = [
  'owner_president',
  'warehouse_manager',
  'logistics_coordinator',
  'qc_inspector',
  'delivery_person',
];

// Which tabs each role can see
export const ROLE_TAB_ACCESS: Record<AppRole, string[]> = {
  owner_president:       ['dashboard', 'warehouse', 'stock-lookup'],
  warehouse_manager:     ['dashboard', 'warehouse', 'stock-lookup'],
  logistics_coordinator: ['dashboard', 'warehouse', 'stock-lookup'],
  qc_inspector:          ['dashboard', 'stock-lookup'],
  delivery_person:       ['stock-lookup'],
  finance_manager:       [],
  procurement_manager:   [],
  sales_processor:       [],
  b2b_customer:          [],
  supplier:              [],
};
