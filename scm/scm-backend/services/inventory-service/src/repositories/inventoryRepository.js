import {
  getInventoryItemRest,
  listBackorderAgingRest,
  listBackorderAlertsRest,
  listInventoryRest,
  receiveScanRest,
} from "../lib/supabaseRest.js";
import {
  getPool,
  hasDatabaseConfig,
  hasSupabaseRestConfig,
} from "../lib/database.js";
import { createHttpError } from "../lib/http.js";

const useRestFallback = () => !hasDatabaseConfig && hasSupabaseRestConfig;

const computeStatus = (qty) => {
  if (qty === 0) return "zero";
  if (qty < 500) return "low";
  return "normal";
};

const mapInventoryRow = (row) => {
  const systemCount = Number(row.qty_on_hand ?? row.inventory_on_hand ?? 0);

  return {
    id: String(row.product_id),
    productUuid: row.product_uuid ? String(row.product_uuid) : null,
    sku: row.sku ?? "N/A",
    barcode: String(row.barcode ?? ""),
    name: row.product_name ?? "Unknown Product",
    unit: row.unit ?? "-",
    reservedStock: Number(row.reserved_stock ?? 0),
    lastUpdated: row.inventory_updated_at ?? row.updated_at ?? null,
    systemCount,
    status: computeStatus(systemCount),
  };
};

export const listInventory = async (pagination) => {
  if (useRestFallback()) {
    return listInventoryRest(pagination);
  }

  const pool = getPool();
  const params = [];
  const conditions = [];

  if (pagination.search) {
    params.push(`%${pagination.search}%`);
    conditions.push(
      `(p.sku ILIKE $${params.length} OR p.product_name ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`,
    );
  }

  params.push(pagination.limit, pagination.offset);
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
      SELECT
        p.product_id,
        p.product_uuid,
        p.sku,
        p.barcode,
        p.product_name,
        p.unit,
        p.reserved_stock,
        p.inventory_on_hand,
        inv.qty_on_hand,
        inv.updated_at AS inventory_updated_at
      FROM products p
      LEFT JOIN LATERAL (
        SELECT qty_on_hand, updated_at
        FROM inventory_on_hand ioh
        WHERE CAST(ioh.product_id AS TEXT) = COALESCE(CAST(p.product_uuid AS TEXT), CAST(p.product_id AS TEXT))
           OR CAST(ioh.product_id AS TEXT) = CAST(p.product_id AS TEXT)
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      ) inv ON TRUE
      ${whereClause}
      ORDER BY p.product_name ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params,
  );

  return result.rows.map(mapInventoryRow);
};

export const getInventoryItem = async (productId) => {
  if (useRestFallback()) {
    const item = await getInventoryItemRest(productId);
    if (!item) {
      throw createHttpError(404, "Inventory item not found");
    }
    return item;
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        p.product_id,
        p.product_uuid,
        p.sku,
        p.barcode,
        p.product_name,
        p.unit,
        p.reserved_stock,
        p.inventory_on_hand,
        inv.qty_on_hand,
        inv.updated_at AS inventory_updated_at
      FROM products p
      LEFT JOIN LATERAL (
        SELECT qty_on_hand, updated_at
        FROM inventory_on_hand ioh
        WHERE CAST(ioh.product_id AS TEXT) = COALESCE(CAST(p.product_uuid AS TEXT), CAST(p.product_id AS TEXT))
           OR CAST(ioh.product_id AS TEXT) = CAST(p.product_id AS TEXT)
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      ) inv ON TRUE
      WHERE CAST(p.product_id AS TEXT) = $1
      LIMIT 1
    `,
    [String(productId)],
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError(404, "Inventory item not found");
  }

  return mapInventoryRow(row);
};

export const receiveScan = async (payload) => {
  if (hasSupabaseRestConfig) {
    return receiveScanRest(payload);
  }

  throw createHttpError(
    503,
    "Supabase REST env vars are required for realtime stock sync in inventory-service.",
  );
};

export const listBackorderAlerts = async (limit) => {
  if (useRestFallback()) {
    return listBackorderAlertsRest(limit);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        id,
        sku,
        message,
        grn_reference,
        pending_backorder_count,
        created_at
      FROM backorder_alerts
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
};

export const listBackorderAging = async (limit) => {
  if (useRestFallback()) {
    return listBackorderAgingRest(limit);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT
        backorder_id,
        order_uuid,
        order_no,
        retailer_name,
        sku,
        qty_backordered,
        created_at,
        age_days,
        latest_status
      FROM v_backorder_aging
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
};
