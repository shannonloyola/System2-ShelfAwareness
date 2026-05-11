// Re-export the shared Supabase clients to avoid multiple instances
export {
  supabase,
  supabaseSCM,
  supabaseFulfillment,
  supabaseQuality,
  supabaseSupportIntel,
} from "../utils/supabase/client";
