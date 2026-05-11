import { createClient } from '@supabase/supabase-js';
import { env } from './config/env.js';

// Identity client (auth)
const supabase = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  { auth: { persistSession: false } }
);

// Supply Chain client (inventory, suppliers)
const supabaseSCM = createClient(
  env.scmSupabaseUrl,
  env.scmSupabaseAnonKey,
  { auth: { persistSession: false } }
);

// Simple sanity check
if (!env.supabaseUrl || (!env.supabaseAnonKey && !env.supabaseServiceRoleKey)) {
  console.error('[SUPABASE] Missing Identity config', {
    url: !!env.supabaseUrl,
    anon: !!env.supabaseAnonKey,
    service: !!env.supabaseServiceRoleKey,
  });
}
if (!env.scmSupabaseUrl || (!env.scmSupabaseAnonKey && !env.scmSupabaseServiceRoleKey)) {
  console.error('[SUPABASE] Missing Supply Chain config', {
    url: !!env.scmSupabaseUrl,
    anon: !!env.scmSupabaseAnonKey,
  });
}

export { supabase, supabaseSCM };
