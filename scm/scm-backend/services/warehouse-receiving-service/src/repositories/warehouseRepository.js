import {
  postGrnDraftRest,
  saveGrnDraftRest,
  saveGrnQualityChecksRest,
  scheduleDeliveryRest,
} from "../lib/supabaseRest.js";
import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for warehouse-receiving-service.",
    );
  }
};

export const saveGrnDraft = async (payload) => {
  requireSupabaseConfig();
  return saveGrnDraftRest(payload);
};

export const postGrnDraft = async ({ grnDraftId, postedBy }) => {
  requireSupabaseConfig();
  return postGrnDraftRest({ grnDraftId, postedBy });
};

export const saveGrnQualityChecks = async (payload) => {
  requireSupabaseConfig();
  return saveGrnQualityChecksRest(payload);
};

export const scheduleDelivery = async (payload) => {
  requireSupabaseConfig();
  return scheduleDeliveryRest(payload);
};
