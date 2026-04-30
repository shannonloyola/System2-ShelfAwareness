import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";
import {
  approveStockAdjustmentRest,
  createStockAdjustmentRest,
  listStockAdjustmentsRest,
  rejectStockAdjustmentRest,
} from "../lib/supabaseRest.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for stock-adjustment-service.",
    );
  }
};

export const listStockAdjustments = async ({ status, requestHeaders }) => {
  requireSupabaseConfig();
  return listStockAdjustmentsRest({ status, requestHeaders });
};

export const createStockAdjustment = async ({ payload, requestHeaders }) => {
  requireSupabaseConfig();
  return createStockAdjustmentRest({ payload, requestHeaders });
};

export const approveStockAdjustment = async ({
  adjustmentId,
  managerName,
  requestHeaders,
}) => {
  requireSupabaseConfig();
  return approveStockAdjustmentRest({
    adjustmentId,
    managerName,
    requestHeaders,
  });
};

export const rejectStockAdjustment = async ({
  adjustmentId,
  managerName,
  note,
  requestHeaders,
}) => {
  requireSupabaseConfig();
  return rejectStockAdjustmentRest({
    adjustmentId,
    managerName,
    note,
    requestHeaders,
  });
};
