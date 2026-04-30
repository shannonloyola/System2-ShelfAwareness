import { hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";
import { addRecentCount, listRecentCounts } from "../lib/memoryStore.js";
import {
  getProductByBarcodeRest,
  getProductBySkuRest,
  listShelfItemsRest,
} from "../lib/supabaseRest.js";

const requireSupabaseConfig = () => {
  if (!hasSupabaseRestConfig) {
    throw createHttpError(
      503,
      "SUPABASE_URL and SUPABASE_ANON_KEY are required for cycle-counting-service.",
    );
  }
};

const buildCountRecord = ({
  product_id,
  sku,
  product_name,
  physical_count,
  counted_by,
  created_by,
  import_source,
}) => ({
  id: `count-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  product_id,
  sku,
  product_name,
  physical_count,
  counted_by,
  created_by: created_by ?? null,
  import_source: import_source ?? null,
  created_at: new Date().toISOString(),
});

export const listShelfItems = async ({ limit }) => {
  requireSupabaseConfig();
  return listShelfItemsRest({ limit });
};

export const getProductByBarcode = async (barcode) => {
  requireSupabaseConfig();
  return getProductByBarcodeRest(barcode);
};

export const listRecentCycleCounts = async ({ limit }) => listRecentCounts(limit);

export const createCycleCount = async (payload) => {
  const record = buildCountRecord(payload);
  return addRecentCount(record);
};

export const createBulkCycleCounts = async ({
  counts,
  counted_by,
  created_by,
  import_source,
}) => {
  requireSupabaseConfig();

  const saved = [];
  const failures = [];

  for (const row of counts) {
    try {
      const product = await getProductBySkuRest(row.sku);

      if (!product) {
        failures.push({
          sku: row.sku,
          error: "Product not found",
        });
        continue;
      }

      const record = buildCountRecord({
        product_id: String(product.id),
        sku: product.sku,
        product_name: product.product_name,
        physical_count: row.qty,
        counted_by,
        created_by,
        import_source,
      });

      addRecentCount(record);
      saved.push(record);
    } catch (error) {
      failures.push({
        sku: row.sku,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    saved,
    failures,
  };
};
