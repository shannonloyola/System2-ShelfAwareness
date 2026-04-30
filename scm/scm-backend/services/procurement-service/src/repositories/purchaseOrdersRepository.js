import {
  createPurchaseOrderItemRest,
  createPurchaseOrderRest,
  deletePurchaseOrderItemRest,
  deletePurchaseOrderRest,
  getPurchaseOrderByIdRest,
  listPurchaseOrderItemsRest,
  listPurchaseOrdersRest,
  updatePurchaseOrderItemRest,
  updatePurchaseOrderRest,
} from "../lib/supabaseRest.js";
import { getPool, hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";

const poSelect = `
  po_id,
  po_no,
  supplier_name,
  status,
  created_at,
  paid_at,
  expected_delivery_date,
  preferred_communication
`;

const poItemSelect = `
  po_item_id,
  po_id,
  item_name,
  quantity
`;

const mapPO = (row) => ({
  po_id: row.po_id,
  po_no: row.po_no,
  supplier_name: row.supplier_name,
  status: row.status,
  created_at: row.created_at,
  paid_at: row.paid_at,
  expected_delivery_date: row.expected_delivery_date,
  preferred_communication: row.preferred_communication,
});

const mapPOItem = (row) => ({
  po_item_id: row.po_item_id,
  po_id: row.po_id,
  item_name: row.item_name,
  quantity: row.quantity,
});

const useRestFallback = () => !hasDatabaseConfig && hasSupabaseRestConfig;

export const listPurchaseOrders = async ({ limit, offset, search, status }) => {
  if (useRestFallback()) {
    return listPurchaseOrdersRest({ limit, offset, search, status });
  }

  const pool = getPool();
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(po_no ILIKE $${params.length} OR supplier_name ILIKE $${params.length})`,
    );
  }

  if (status) {
    params.push(status);
    conditions.push(`LOWER(status) = LOWER($${params.length})`);
  }

  params.push(limit, offset);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
      SELECT ${poSelect}
      FROM purchase_orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params,
  );

  return result.rows.map(mapPO);
};

export const getPurchaseOrderById = async (poId) => {
  if (useRestFallback()) {
    const po = await getPurchaseOrderByIdRest(poId);
    if (!po) {
      throw createHttpError(404, "Purchase order not found");
    }
    return po;
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${poSelect}
      FROM purchase_orders
      WHERE po_id = $1
      LIMIT 1
    `,
    [poId],
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError(404, "Purchase order not found");
  }

  return mapPO(row);
};

export const listPurchaseOrderItems = async (poId) => {
  if (useRestFallback()) {
    return listPurchaseOrderItemsRest(poId);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${poItemSelect}
      FROM purchase_order_items
      WHERE po_id = $1
      ORDER BY po_item_id ASC
    `,
    [poId],
  );

  return result.rows.map(mapPOItem);
};

export const generateNextPONumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `PO-JP-${year}-`;

  const purchaseOrders = await listPurchaseOrders({
    limit: 500,
    offset: 0,
    search: prefix,
    status: "",
  });

  const maxSuffix = purchaseOrders.reduce((max, row) => {
    const value = row.po_no ?? "";
    const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) return max;
    const next = Number(match[1]);
    if (Number.isNaN(next)) return max;
    return Math.max(max, next);
  }, 0);

  return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
};

export const createPurchaseOrder = async (payload) => {
  const resolvedPayload = {
    po_no: payload.po_no || (await generateNextPONumber()),
    supplier_name: payload.supplier_name,
    status: payload.status || "Draft",
    created_at: payload.created_at || new Date().toISOString(),
    paid_at:
      payload.paid_at === undefined
        ? new Date().toISOString()
        : payload.paid_at,
    expected_delivery_date: payload.expected_delivery_date ?? null,
    preferred_communication: payload.preferred_communication ?? null,
  };

  if (useRestFallback()) {
    return createPurchaseOrderRest(resolvedPayload);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO purchase_orders (
        po_no,
        supplier_name,
        status,
        created_at,
        paid_at,
        expected_delivery_date,
        preferred_communication
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${poSelect}
    `,
    [
      resolvedPayload.po_no,
      resolvedPayload.supplier_name,
      resolvedPayload.status,
      resolvedPayload.created_at,
      resolvedPayload.paid_at,
      resolvedPayload.expected_delivery_date,
      resolvedPayload.preferred_communication,
    ],
  );

  return mapPO(result.rows[0]);
};

export const updatePurchaseOrder = async (poId, payload) => {
  if (useRestFallback()) {
    const po = await updatePurchaseOrderRest(poId, payload);
    if (!po) {
      throw createHttpError(404, "Purchase order not found");
    }
    return po;
  }

  const pool = getPool();
  const columnMap = {
    po_no: "po_no",
    supplier_name: "supplier_name",
    status: "status",
    paid_at: "paid_at",
    expected_delivery_date: "expected_delivery_date",
    preferred_communication: "preferred_communication",
  };

  const updates = [];
  const values = [];

  for (const [key, column] of Object.entries(columnMap)) {
    if (key in payload) {
      values.push(payload[key]);
      updates.push(`${column} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    throw createHttpError(400, "No valid purchase order fields provided");
  }

  values.push(poId);

  const result = await pool.query(
    `
      UPDATE purchase_orders
      SET ${updates.join(", ")}
      WHERE po_id = $${values.length}
      RETURNING ${poSelect}
    `,
    values,
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError(404, "Purchase order not found");
  }

  return mapPO(row);
};

export const createPurchaseOrderItem = async (poId, payload) => {
  const existingItems = await listPurchaseOrderItems(poId);
  const duplicate = existingItems.some(
    (item) =>
      String(item.item_name || "").trim().toLowerCase() ===
      payload.item_name.trim().toLowerCase(),
  );

  if (duplicate) {
    throw createHttpError(409, "Duplicate line item is not allowed");
  }

  if (useRestFallback()) {
    return createPurchaseOrderItemRest({
      po_id: poId,
      item_name: payload.item_name,
      quantity: payload.quantity,
    });
  }

  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO purchase_order_items (
        po_id,
        item_name,
        quantity
      )
      VALUES ($1, $2, $3)
      RETURNING ${poItemSelect}
    `,
    [poId, payload.item_name, payload.quantity],
  );

  return mapPOItem(result.rows[0]);
};

export const updatePurchaseOrderItem = async (poId, poItemId, payload) => {
  if (useRestFallback()) {
    const item = await updatePurchaseOrderItemRest(poId, poItemId, payload);
    if (!item) {
      throw createHttpError(404, "Purchase order item not found");
    }
    return item;
  }

  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE purchase_order_items
      SET quantity = $1
      WHERE po_id = $2 AND po_item_id = $3
      RETURNING ${poItemSelect}
    `,
    [payload.quantity, poId, poItemId],
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError(404, "Purchase order item not found");
  }

  return mapPOItem(row);
};

export const deletePurchaseOrderItem = async (poId, poItemId) => {
  if (useRestFallback()) {
    await deletePurchaseOrderItemRest(poId, poItemId);
    return { po_item_id: poItemId };
  }

  const pool = getPool();
  const result = await pool.query(
    `
      DELETE FROM purchase_order_items
      WHERE po_id = $1 AND po_item_id = $2
      RETURNING po_item_id
    `,
    [poId, poItemId],
  );

  if (!result.rows[0]) {
    throw createHttpError(404, "Purchase order item not found");
  }

  return { po_item_id: result.rows[0].po_item_id };
};

export const importPurchaseOrder = async (payload) => {
  if (useRestFallback()) {
    const po = await createPurchaseOrder(payload);
    try {
      for (const item of payload.items) {
        await createPurchaseOrderItemRest({
          po_id: po.po_id,
          item_name: item.item_name,
          quantity: item.quantity,
        });
      }
      return po;
    } catch (error) {
      await deletePurchaseOrderRest(po.po_id);
      throw error;
    }
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const poNo = payload.po_no || (await generateNextPONumber());
    const createdAt = new Date().toISOString();
    const poResult = await client.query(
      `
        INSERT INTO purchase_orders (
          po_no,
          supplier_name,
          status,
          created_at,
          paid_at,
          expected_delivery_date,
          preferred_communication
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${poSelect}
      `,
      [
        poNo,
        payload.supplier_name,
        payload.status || "Draft",
        createdAt,
        createdAt,
        payload.expected_delivery_date ?? null,
        payload.preferred_communication ?? null,
      ],
    );

    const po = mapPO(poResult.rows[0]);

    for (const item of payload.items) {
      await client.query(
        `
          INSERT INTO purchase_order_items (
            po_id,
            item_name,
            quantity
          )
          VALUES ($1, $2, $3)
        `,
        [po.po_id, item.item_name, item.quantity],
      );
    }

    await client.query("COMMIT");
    return po;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
