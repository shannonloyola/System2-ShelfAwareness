import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

if (!env.supabaseUrl || (!env.supabaseAnonKey && !env.supabaseServiceRoleKey)) {
  console.error('[SUPABASE] Missing configuration!', {
    url: !!env.supabaseUrl,
    anon: !!env.supabaseAnonKey,
    service: !!env.supabaseServiceRoleKey,
  });
}

// Use service role key if available for backend operations
const supabaseKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;

export const supabase = createClient(env.supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

console.log('[SUPABASE] Client initialized with URL:', env.supabaseUrl);
