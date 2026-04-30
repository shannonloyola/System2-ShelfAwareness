import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";
import { saveGrnQualityChecksRest } from "../lib/supabaseRest.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for discrepancy-qc-service.",
    );
  }
};

export const saveGrnQualityChecks = async (payload) => {
  requireSupabaseConfig();
  return saveGrnQualityChecksRest(payload);
};
