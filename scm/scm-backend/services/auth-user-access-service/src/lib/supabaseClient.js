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

const identityKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
export const supabase = createClient(env.supabaseUrl, identityKey, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});
export const supabaseSCM = createClient(env.scmSupabaseUrl, env.scmSupabaseAnonKey, {
  auth: { persistSession: false },
  db: { schema: 'public' },
});

console.log('[SUPABASE] Identity client initialized with URL:', env.supabaseUrl);
console.log('[SUPABASE] Supply Chain client initialized with URL:', env.scmSupabaseUrl);
