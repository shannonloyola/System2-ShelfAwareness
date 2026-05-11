import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

if (!env.supabaseUrl || (!env.supabaseAnonKey && !env.supabaseServiceRoleKey)) {
  console.error('[SUPABASE] Missing Identity configuration!', {
    url: !!env.supabaseUrl,
    anon: !!env.supabaseAnonKey,
    service: !!env.supabaseServiceRoleKey,
  });
}

if (!env.scmSupabaseUrl || !env.scmSupabaseAnonKey) {
  console.error('[SUPABASE] Missing Supply Chain configuration!', {
    url: !!env.scmSupabaseUrl,
    anon: !!env.scmSupabaseAnonKey,
  });
}

if (!env.fulfillmentSupabaseUrl || !env.fulfillmentSupabaseServiceRoleKey) {
  console.error('[SUPABASE] Missing Fulfillment configuration!', {
    url: !!env.fulfillmentSupabaseUrl,
    service: !!env.fulfillmentSupabaseServiceRoleKey,
  });
}

// Identity client (auth)
const identityKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
export const supabase = createClient(env.supabaseUrl, identityKey, {
  auth: { persistSession: false },
});

// Supply Chain client (Suppliers, etc.)
export const supabaseSCM = createClient(env.scmSupabaseUrl, env.scmSupabaseAnonKey, {
  auth: { persistSession: false },
});

// Fulfillment client (Inventory, etc.)
const fulfillmentKey = env.fulfillmentSupabaseServiceRoleKey || env.fulfillmentSupabaseAnonKey;
export const supabaseFulfillment = createClient(env.fulfillmentSupabaseUrl, fulfillmentKey, {
  auth: { persistSession: false },
});

console.log('[SUPABASE] Identity client initialized with URL:', env.supabaseUrl);
console.log('[SUPABASE] Supply Chain client initialized with URL:', env.scmSupabaseUrl);
console.log('[SUPABASE] Fulfillment client initialized with URL:', env.fulfillmentSupabaseUrl);
