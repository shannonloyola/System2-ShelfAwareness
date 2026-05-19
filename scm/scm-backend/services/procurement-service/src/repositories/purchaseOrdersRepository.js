import {
  clearWinnerFreightQuotesRest,
  createFreightQuoteRest,
  createPurchaseOrderStatusHistoryRest,
  createPurchaseOrderItemRest,
  createPurchaseOrderRest,
  deletePurchaseOrderItemRest,
  deletePurchaseOrderRest,
  getProductAssociationRulesRest,
  getPurchaseOrderByIdRest,
  getCurrentMonthlyBudgetRest,
  listFreightQuotesRest,
  listCustomsTrackedPurchaseOrdersRest,
  listPurchaseOrderItemsRest,
  listPurchaseOrderStatusHistoryRest,
  listPurchaseOrdersRest,
  listExpiredReservationsRest,
  listExpiringSoonReservationsRest,
  runExpireReservationsRest,
  updateFreightQuoteRest,
  updatePurchaseOrderStatusHistoryRest,
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
  updated_at,
  paid_at,
  expected_delivery_date,
  preferred_communication,
  approval_status,
  approved_by,
  approved_at,
  rejected_at,
  rejection_reason,
  is_late,
  customs_entry_date,
  customs_release_date,
  duties_paid,
  transit_status,
  transit_updated_at,
  transit_updated_by,
  transit_notes,
  carrier_name,
  carrier_tracking_ref,
  freight_mode,
  freight_cost,
  freight_type,
  reserved_at,
  expires_at,
  (
    SELECT COUNT(*)
    FROM purchase_order_items poi
    WHERE poi.po_id = purchase_orders.po_id
  )::int AS item_count
`;

const poItemSelect = `
  po_item_id,
  po_id,
  item_name,
  quantity
`;

const poStatusHistorySelect = `
  history_id,
  po_id,
  status_name,
  changed_at,
  document_url,
  reason
`;

const freightQuoteSelect = `
  id,
  po_id,
  po_no,
  provider,
  freight_type,
  cost,
  estimated_days,
  is_winner,
  created_at,
  updated_at
`;

const mapPO = (row) => ({
  po_id: row.po_id,
  po_no: row.po_no,
  supplier_name: row.supplier_name,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at ?? row.created_at,
  paid_at: row.paid_at,
  expected_delivery_date: row.expected_delivery_date,
  preferred_communication: row.preferred_communication,
  approval_status: row.approval_status,
  approved_by: row.approved_by,
  approved_at: row.approved_at,
  rejected_at: row.rejected_at,
  rejection_reason: row.rejection_reason,
  is_late: row.is_late,
  customs_entry_date: row.customs_entry_date,
  customs_release_date: row.customs_release_date,
  duties_paid:
    row.duties_paid === null || row.duties_paid === undefined
      ? null
      : Number(row.duties_paid),
  transit_status: row.transit_status,
  transit_updated_at: row.transit_updated_at ?? null,
  transit_updated_by: row.transit_updated_by ?? null,
  transit_notes: row.transit_notes ?? null,
  carrier_name: row.carrier_name ?? null,
  carrier_tracking_ref: row.carrier_tracking_ref ?? null,
  freight_mode: row.freight_mode ?? null,
  freight_cost:
    row.freight_cost === null || row.freight_cost === undefined
      ? null
      : Number(row.freight_cost),
  freight_type: row.freight_type ?? null,
  reserved_at: row.reserved_at,
  expires_at: row.expires_at,
  item_count: Array.isArray(row.purchase_order_items)
    ? Number(row.purchase_order_items[0]?.count ?? 0)
    : Number(row.item_count ?? 0),
});

const mapPOItem = (row) => ({
  po_item_id: row.po_item_id,
  po_id: row.po_id,
  item_name: row.item_name,
  quantity: row.quantity,
});

const mapProductAssociation = (row) => ({
  product_name: row.product_name,
  support: Number(row.support),
  confidence: Number(row.confidence),
  co_occurrences: Number(row.co_occurrences),
});

const normalizeAssociationKey = (value) =>
  String(value ?? "").trim().toLowerCase();

const computeAssociationRulesFromRows = ({
  productName,
  purchaseOrders,
  itemRowsByPoId,
  minSupport,
  minConfidence,
  maxResults,
}) => {
  const targetKey = normalizeAssociationKey(productName);
  const validStatuses = new Set(["draft", "cancelled", "rejected"]);

  const baskets = purchaseOrders
    .filter((po) => !validStatuses.has(normalizeAssociationKey(po.status)))
    .map((po) => {
      const items = itemRowsByPoId.get(po.po_id) ?? [];
      const deduped = new Map();

      items.forEach((item) => {
        const itemName = String(item.item_name ?? "").trim();
        if (!itemName) return;
        const key = normalizeAssociationKey(itemName);
        if (!deduped.has(key)) {
          deduped.set(key, itemName);
        }
      });

      return deduped;
    })
    .filter((basket) => basket.size > 0);

  const totalPOs = baskets.length;
  const targetBaskets = baskets.filter((basket) => basket.has(targetKey));
  const targetOccurrences = targetBaskets.length;

  if (totalPOs === 0 || targetOccurrences === 0) {
    return {
      product: String(productName ?? "").trim(),
      associations: [],
      totalPOs,
      targetOccurrences,
      thresholds: {
        minSupport,
        minConfidence,
      },
    };
  }

  const coOccurrenceCounts = new Map();

  targetBaskets.forEach((basket) => {
    basket.forEach((label, key) => {
      if (key === targetKey) return;
      const current = coOccurrenceCounts.get(key) ?? {
        product_name: label,
        co_occurrences: 0,
      };
      current.co_occurrences += 1;
      coOccurrenceCounts.set(key, current);
    });
  });

  const associations = Array.from(coOccurrenceCounts.values())
    .map((entry) => ({
      product_name: entry.product_name,
      support: Number((entry.co_occurrences / totalPOs).toFixed(4)),
      confidence: Number(
        (entry.co_occurrences / targetOccurrences).toFixed(4),
      ),
      co_occurrences: entry.co_occurrences,
    }))
    .filter(
      (entry) =>
        entry.support >= minSupport &&
        entry.confidence >= minConfidence,
    )
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        right.support - left.support ||
        right.co_occurrences - left.co_occurrences ||
        left.product_name.localeCompare(right.product_name),
    )
    .slice(0, maxResults);

  return {
    product: String(productName ?? "").trim(),
    associations,
    totalPOs,
    targetOccurrences,
    thresholds: {
      minSupport,
      minConfidence,
    },
  };
};

const mapPOStatusHistory = (row) => ({
  history_id: row.history_id,
  po_id: row.po_id,
  status_name: row.status_name,
  changed_at: row.changed_at,
  document_url: row.document_url ?? null,
  reason: row.reason ?? null,
});

const mapFreightQuote = (row) => ({
  id: row.id,
  po_id: row.po_id,
  po_no: row.po_no,
  provider: row.provider,
  freight_type: row.freight_type,
  cost: Number(row.cost),
  estimated_days: Number(row.estimated_days),
  is_winner: Boolean(row.is_winner),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const useRestFallback = () => !hasDatabaseConfig && hasSupabaseRestConfig;

export const listPurchaseOrders = async ({ limit, offset, search, status }) => {
  if (useRestFallback()) {
    const rows = await listPurchaseOrdersRest({ limit, offset, search, status });
    return (rows || []).map(mapPO);
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
    return (await listPurchaseOrderItemsRest(poId)).map(mapPOItem);
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

export const getProductAssociationRules = async ({
  productName,
  minSupport = 0.05,
  minConfidence = 0.3,
  maxResults = 5,
}) => {
  const normalizedProductName = String(productName ?? "").trim();
  if (!normalizedProductName) {
    throw createHttpError(400, "product_name is required");
  }

  const statsQuery = `
    WITH filtered_orders AS (
      SELECT po_id
      FROM purchase_orders
      WHERE COALESCE(LOWER(TRIM(status)), '') NOT IN ('draft', 'cancelled', 'rejected')
    ),
    distinct_items AS (
      SELECT DISTINCT
        poi.po_id,
        LOWER(TRIM(poi.item_name)) AS item_key
      FROM purchase_order_items poi
      INNER JOIN filtered_orders fo ON fo.po_id = poi.po_id
      WHERE COALESCE(TRIM(poi.item_name), '') <> ''
    )
    SELECT
      (SELECT COUNT(DISTINCT po_id)::int FROM distinct_items) AS total_pos,
      (
        SELECT COUNT(DISTINCT po_id)::int
        FROM distinct_items
        WHERE item_key = LOWER(TRIM($1))
      ) AS target_occurrences
  `;

  const associationQuery = `
    WITH filtered_orders AS (
      SELECT po_id
      FROM purchase_orders
      WHERE COALESCE(LOWER(TRIM(status)), '') NOT IN ('draft', 'cancelled', 'rejected')
    ),
    distinct_items AS (
      SELECT DISTINCT
        poi.po_id,
        LOWER(TRIM(poi.item_name)) AS item_key,
        TRIM(poi.item_name) AS product_name
      FROM purchase_order_items poi
      INNER JOIN filtered_orders fo ON fo.po_id = poi.po_id
      WHERE COALESCE(TRIM(poi.item_name), '') <> ''
    ),
    basket_totals AS (
      SELECT COUNT(DISTINCT po_id)::numeric AS total_pos
      FROM distinct_items
    ),
    target_baskets AS (
      SELECT DISTINCT po_id
      FROM distinct_items
      WHERE item_key = LOWER(TRIM($1))
    ),
    target_totals AS (
      SELECT COUNT(*)::numeric AS target_occurrences
      FROM target_baskets
    ),
    co_occurrences AS (
      SELECT
        di.item_key,
        MIN(di.product_name) AS product_name,
        COUNT(*)::int AS co_occurrences
      FROM distinct_items di
      INNER JOIN target_baskets tb ON tb.po_id = di.po_id
      WHERE di.item_key <> LOWER(TRIM($1))
      GROUP BY di.item_key
    )
    SELECT
      co.product_name,
      ROUND((co.co_occurrences::numeric / NULLIF(bt.total_pos, 0)), 4) AS support,
      ROUND((co.co_occurrences::numeric / NULLIF(tt.target_occurrences, 0)), 4) AS confidence,
      co.co_occurrences
    FROM co_occurrences co
    CROSS JOIN basket_totals bt
    CROSS JOIN target_totals tt
    WHERE (co.co_occurrences::numeric / NULLIF(bt.total_pos, 0)) >= $2
      AND (co.co_occurrences::numeric / NULLIF(tt.target_occurrences, 0)) >= $3
    ORDER BY confidence DESC, support DESC, co.co_occurrences DESC, co.product_name ASC
    LIMIT $4
  `;

  let totalPOs = 0;
  let targetOccurrences = 0;
  let associationRows = [];

  if (useRestFallback()) {
    try {
      const statsRows = await getProductAssociationRulesRest({
        target_product: normalizedProductName,
        min_support: 0,
        min_confidence: 0,
        max_results: 100,
      });

      const allRows = Array.isArray(statsRows) ? statsRows : [];
      totalPOs = Number(allRows[0]?.total_pos ?? 0);
      targetOccurrences = Number(allRows[0]?.target_occurrences ?? 0);
      associationRows = allRows.filter((row) => {
        const support = Number(row.support);
        const confidence = Number(row.confidence);
        return support >= minSupport && confidence >= minConfidence;
      });
    } catch (error) {
      const purchaseOrders = await listPurchaseOrders({
        limit: 500,
        offset: 0,
        search: "",
        status: "",
      });
      const itemRowsByPoId = new Map();
      await Promise.all(
        purchaseOrders.map(async (po) => {
          const items = await listPurchaseOrderItems(po.po_id);
          itemRowsByPoId.set(po.po_id, items);
        }),
      );

      return computeAssociationRulesFromRows({
        productName: normalizedProductName,
        purchaseOrders,
        itemRowsByPoId,
        minSupport,
        minConfidence,
        maxResults,
      });
    }
  } else {
    const pool = getPool();
    const statsResult = await pool.query(statsQuery, [normalizedProductName]);
    totalPOs = Number(statsResult.rows[0]?.total_pos ?? 0);
    targetOccurrences = Number(
      statsResult.rows[0]?.target_occurrences ?? 0,
    );

    if (targetOccurrences > 0) {
      const associationResult = await pool.query(associationQuery, [
        normalizedProductName,
        minSupport,
        minConfidence,
        maxResults,
      ]);
      associationRows = associationResult.rows;
    }
  }

  return {
    product: normalizedProductName,
    associations: associationRows.map(mapProductAssociation).slice(0, maxResults),
    totalPOs,
    targetOccurrences,
    thresholds: {
      minSupport,
      minConfidence,
    },
  };
};

export const getProductAssociationDiagnostics = async ({
  minCoOccurrences = 1,
  maxResults = 25,
}) => {
  const validStatuses = new Set(["draft", "cancelled", "rejected"]);
  const purchaseOrders = await listPurchaseOrders({
    limit: 500,
    offset: 0,
    search: "",
    status: "",
  });

  const itemRowsByPoId = new Map();
  await Promise.all(
    purchaseOrders.map(async (po) => {
      const items = await listPurchaseOrderItems(po.po_id);
      itemRowsByPoId.set(po.po_id, items);
    }),
  );

  const baskets = purchaseOrders
    .filter((po) => !validStatuses.has(normalizeAssociationKey(po.status)))
    .map((po) => {
      const items = itemRowsByPoId.get(po.po_id) ?? [];
      const deduped = Array.from(
        new Map(
          items
            .map((item) => {
              const label = String(item.item_name ?? "").trim();
              return [normalizeAssociationKey(label), label];
            })
            .filter(([key, label]) => key && label),
        ).entries(),
      );

      return deduped;
    })
    .filter((basket) => basket.length > 1);

  const totalPOs = baskets.length;
  const itemCounts = new Map();
  const pairCounts = new Map();

  baskets.forEach((basket) => {
    basket.forEach(([key]) => {
      itemCounts.set(key, (itemCounts.get(key) ?? 0) + 1);
    });

    for (let leftIndex = 0; leftIndex < basket.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < basket.length;
        rightIndex += 1
      ) {
        const [leftKey, leftLabel] = basket[leftIndex];
        const [rightKey, rightLabel] = basket[rightIndex];
        const pairKey = [leftKey, rightKey].sort().join("||");
        const current = pairCounts.get(pairKey) ?? {
          product_a: leftLabel,
          product_b: rightLabel,
          co_occurrences: 0,
          left_key: leftKey,
          right_key: rightKey,
        };
        current.co_occurrences += 1;
        pairCounts.set(pairKey, current);
      }
    }
  });

  const pairs = Array.from(pairCounts.values())
    .filter((pair) => pair.co_occurrences >= minCoOccurrences)
    .map((pair) => {
      const occurrencesA = itemCounts.get(pair.left_key) ?? 0;
      const occurrencesB = itemCounts.get(pair.right_key) ?? 0;
      return {
        product_a: pair.product_a,
        product_b: pair.product_b,
        co_occurrences: pair.co_occurrences,
        support: totalPOs
          ? Number((pair.co_occurrences / totalPOs).toFixed(4))
          : 0,
        confidence_a_to_b: occurrencesA
          ? Number((pair.co_occurrences / occurrencesA).toFixed(4))
          : 0,
        confidence_b_to_a: occurrencesB
          ? Number((pair.co_occurrences / occurrencesB).toFixed(4))
          : 0,
        occurrences_a: occurrencesA,
        occurrences_b: occurrencesB,
      };
    })
    .sort(
      (left, right) =>
        right.co_occurrences - left.co_occurrences ||
        right.support - left.support ||
        left.product_a.localeCompare(right.product_a) ||
        left.product_b.localeCompare(right.product_b),
    )
    .slice(0, maxResults);

  return {
    totalPOs,
    pairs,
  };
};

export const listPurchaseOrderStatusHistory = async (poId) => {
  if (useRestFallback()) {
    return (await listPurchaseOrderStatusHistoryRest(poId)).map(
      mapPOStatusHistory,
    );
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${poStatusHistorySelect}
      FROM po_status_history
      WHERE po_id = $1
      ORDER BY changed_at DESC
    `,
    [poId],
  );

  return result.rows.map(mapPOStatusHistory);
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

  const maxSuffix = (purchaseOrders || []).reduce((max, row) => {
    const value = row.po_no ?? "";
    const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
    if (!match) return max;
    const next = Number(match[1]);
    if (Number.isNaN(next)) return max;
    return Math.max(max, next);
  }, 0);

  return `${prefix}${String(maxSuffix + 1).padStart(4, "0")}`;
};

const isDuplicatePoNumber = (error) => {
  if (!error) return false;
  const msg = error.message || "";
  // Supabase REST surfaces Postgres error codes in the parsed message JSON
  return (
    error.code === "23505" ||
    msg.includes("23505") ||
    msg.includes("purchase_orders_po_no_key") ||
    (error.details && String(error.details).includes("purchase_orders_po_no_key"))
  );
};

export const createPurchaseOrder = async (payload) => {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Always regenerate the PO number on retry to avoid the duplicate
    const po_no =
      attempt === 1
        ? payload.po_no || (await generateNextPONumber())
        : await generateNextPONumber();

    const resolvedPayload = {
      po_no,
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

    try {
      if (useRestFallback()) {
        const po = await createPurchaseOrderRest(resolvedPayload);
        return mapPO(po);
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
    } catch (error) {
      if (isDuplicatePoNumber(error) && attempt < MAX_RETRIES) {
        console.warn(
          `[procurement] PO number conflict on attempt ${attempt} (${resolvedPayload.po_no}), retrying...`,
        );
        continue;
      }
      throw error;
    }
  }
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
    approval_status: "approval_status",
    approved_by: "approved_by",
    approved_at: "approved_at",
    rejected_at: "rejected_at",
    rejection_reason: "rejection_reason",
    transit_status: "transit_status",
    transit_updated_at: "transit_updated_at",
    transit_updated_by: "transit_updated_by",
    transit_notes: "transit_notes",
    carrier_name: "carrier_name",
    carrier_tracking_ref: "carrier_tracking_ref",
    customs_entry_date: "customs_entry_date",
    customs_release_date: "customs_release_date",
    duties_paid: "duties_paid",
    freight_mode: "freight_mode",
    freight_cost: "freight_cost",
    freight_type: "freight_type",
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

export const updatePurchaseOrderApproval = async (poId, payload) => {
  const nextStatus = String(payload.approval_status || "Pending").toLowerCase();
  const nowIso = new Date().toISOString();

  return updatePurchaseOrder(poId, {
    approval_status: payload.approval_status,
    approved_by: payload.approved_by ?? null,
    approved_at: nextStatus === "approved" ? nowIso : null,
    rejected_at: nextStatus === "rejected" ? nowIso : null,
    rejection_reason: nextStatus === "rejected" ? payload.rejection_reason : null,
  });
};

export const getFreightQuotes = async (poId) => {
  if (useRestFallback()) {
    return (await listFreightQuotesRest(poId)).map(mapFreightQuote);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${freightQuoteSelect}
      FROM freight_quotes
      WHERE po_id = $1
      ORDER BY created_at ASC
    `,
    [poId],
  );

  return result.rows.map(mapFreightQuote);
};

export const createFreightQuote = async (poId, poNo, quoteData) => {
  const payload = {
    po_id: poId,
    po_no: poNo,
    provider: quoteData.provider,
    freight_type: quoteData.freight_type,
    cost: quoteData.cost,
    estimated_days: quoteData.estimated_days,
  };

  if (useRestFallback()) {
    const row = await createFreightQuoteRest(payload);
    return mapFreightQuote(row);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO freight_quotes (
        po_id,
        po_no,
        provider,
        freight_type,
        cost,
        estimated_days
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${freightQuoteSelect}
    `,
    [
      payload.po_id,
      payload.po_no,
      payload.provider,
      payload.freight_type,
      payload.cost,
      payload.estimated_days,
    ],
  );

  return mapFreightQuote(result.rows[0]);
};

export const setWinnerFreightQuote = async (poId, quoteId) => {
  if (useRestFallback()) {
    await clearWinnerFreightQuotesRest(poId, quoteId);
    const winner = await updateFreightQuoteRest(poId, quoteId, {
      is_winner: true,
      updated_at: new Date().toISOString(),
    });
    if (!winner) {
      throw createHttpError(404, "Freight quote not found");
    }

    const updatedPo = await updatePurchaseOrderRest(poId, {
      freight_type: winner.freight_type,
      freight_cost: winner.cost,
    });
    if (!updatedPo) {
      throw createHttpError(404, "Purchase order not found");
    }

    return mapFreightQuote(winner);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const winnerResult = await client.query(
      `
        SELECT ${freightQuoteSelect}
        FROM freight_quotes
        WHERE po_id = $1 AND id = $2
        LIMIT 1
      `,
      [poId, quoteId],
    );
    const winnerRow = winnerResult.rows[0];
    if (!winnerRow) {
      throw createHttpError(404, "Freight quote not found");
    }

    await client.query(
      `
        UPDATE freight_quotes
        SET is_winner = false,
            updated_at = now()
        WHERE po_id = $1 AND id <> $2
      `,
      [poId, quoteId],
    );

    const updatedWinnerResult = await client.query(
      `
        UPDATE freight_quotes
        SET is_winner = true,
            updated_at = now()
        WHERE po_id = $1 AND id = $2
        RETURNING ${freightQuoteSelect}
      `,
      [poId, quoteId],
    );
    const updatedWinner = updatedWinnerResult.rows[0];

    await client.query(
      `
        UPDATE purchase_orders
        SET freight_type = $1,
            freight_cost = $2
        WHERE po_id = $3
      `,
      [updatedWinner.freight_type, updatedWinner.cost, poId],
    );

    await client.query("COMMIT");
    return mapFreightQuote(updatedWinner);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateTransitStatus = async (poId, updateData) => {
  const purchaseOrder = await updatePurchaseOrder(poId, updateData);
  return purchaseOrder;
};

export const appendPurchaseOrderStatusHistory = async (poId, payload) => {
  const resolvedPayload = {
    po_id: poId,
    status_name: payload.status_name,
    changed_at: payload.changed_at ?? new Date().toISOString(),
    document_url: payload.document_url ?? null,
    reason: payload.reason ?? null,
  };

  if (useRestFallback()) {
    const row = await createPurchaseOrderStatusHistoryRest(resolvedPayload);
    return mapPOStatusHistory(row);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO po_status_history (
        po_id,
        status_name,
        changed_at,
        document_url,
        reason
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${poStatusHistorySelect}
    `,
    [
      resolvedPayload.po_id,
      resolvedPayload.status_name,
      resolvedPayload.changed_at,
      resolvedPayload.document_url,
      resolvedPayload.reason,
    ],
  );

  return mapPOStatusHistory(result.rows[0]);
};

export const updateLatestPurchaseOrderDocument = async (poId, payload) => {
  const [latestHistory] = await listPurchaseOrderStatusHistory(poId);
  const targetHistory =
    latestHistory ??
    (await appendPurchaseOrderStatusHistory(poId, {
      status_name: payload.status_name || "Pending Supplier Confirmation",
    }));

  if (useRestFallback()) {
    const row = await updatePurchaseOrderStatusHistoryRest(
      targetHistory.history_id,
      {
        document_url: payload.document_url,
      },
    );
    return mapPOStatusHistory(row);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE po_status_history
      SET document_url = $1
      WHERE history_id = $2
      RETURNING ${poStatusHistorySelect}
    `,
    [payload.document_url, targetHistory.history_id],
  );

  return mapPOStatusHistory(result.rows[0]);
};

export const updatePurchaseOrderEta = async (poId, payload) => {
  if (!useRestFallback()) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const poResult = await client.query(
        `
          UPDATE purchase_orders
          SET expected_delivery_date = $1
          WHERE po_id = $2
          RETURNING ${poSelect}
        `,
        [payload.expected_delivery_date, poId],
      );

      const row = poResult.rows[0];
      if (!row) {
        throw createHttpError(404, "Purchase order not found");
      }

      await client.query(
        `
          INSERT INTO po_status_history (
            po_id,
            status_name,
            changed_at,
            reason
          )
          VALUES ($1, $2, $3, $4)
        `,
        [poId, "ETA Updated", new Date().toISOString(), payload.reason],
      );

      await client.query("COMMIT");
      return mapPO(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const po = await updatePurchaseOrderRest(poId, {
    expected_delivery_date: payload.expected_delivery_date,
  });
  if (!po) {
    throw createHttpError(404, "Purchase order not found");
  }

  await createPurchaseOrderStatusHistoryRest({
    po_id: poId,
    status_name: "ETA Updated",
    changed_at: new Date().toISOString(),
    reason: payload.reason,
  });

  return mapPO(po);
};

export const listExpiringSoonReservations = async () => {
  const beforeIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  if (useRestFallback()) {
    return await listExpiringSoonReservationsRest(beforeIso);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT po_id, po_no, supplier_name, status, expires_at, reserved_at
      FROM purchase_orders
      WHERE status NOT IN ('Paid', 'Expired', 'Cancelled')
        AND expires_at IS NOT NULL
        AND expires_at <= $1
      ORDER BY expires_at ASC
    `,
    [beforeIso],
  );

  return result.rows;
};

export const listExpiredReservations = async () => {
  if (useRestFallback()) {
    return await listExpiredReservationsRest();
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${poSelect}
      FROM purchase_orders
      WHERE status = 'Expired'
      ORDER BY expires_at DESC
    `,
  );

  return result.rows.map(mapPO);
};

export const runExpirationCheck = async () => {
  if (useRestFallback()) {
    return await runExpireReservationsRest();
  }

  const pool = getPool();
  const result = await pool.query(`SELECT * FROM expire_reservations()`);
  return result.rows;
};

export const getCurrentMonthlyBudget = async () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (useRestFallback()) {
    return await getCurrentMonthlyBudgetRest(month, year);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT allocated_amount, spent_amount, month, year
      FROM monthly_budgets
      WHERE month = $1 AND year = $2
      LIMIT 1
    `,
    [month, year],
  );

  return result.rows[0] ?? null;
};

export const listCustomsDelays = async () => {
  let rows;

  if (useRestFallback()) {
    rows = await listCustomsTrackedPurchaseOrdersRest();
  } else {
    const pool = getPool();
    const result = await pool.query(
      `
        SELECT
          po_id,
          po_no,
          supplier_name,
          customs_entry_date,
          customs_release_date,
          transit_status
        FROM purchase_orders
        WHERE customs_entry_date IS NOT NULL
        ORDER BY customs_entry_date ASC
      `,
    );
    rows = result.rows;
  }

  return rows.filter((row) => {
    const transitStatus = row.transit_status ?? "";
    const entryDate = row.customs_entry_date
      ? new Date(row.customs_entry_date)
      : null;
    const ageInDays = entryDate
      ? (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    return (
      transitStatus === "Stuck at Customs" ||
      (Boolean(entryDate) && !row.customs_release_date && ageInDays > 5)
    );
  });
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
      return mapPO(po);
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
