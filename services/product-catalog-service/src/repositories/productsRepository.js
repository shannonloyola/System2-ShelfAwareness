import {
  createProductRest,
  deleteProductRest,
  getProductByIdRest,
  importProductsRest,
  listCategoriesRest,
  listPricingHistoryRest,
  listProductsRest,
  updateProductRest,
} from "../lib/supabaseRest.js";
import {
  getPool,
  hasDatabaseConfig,
  hasSupabaseRestConfig,
} from "../lib/database.js";
import { createHttpError } from "../lib/http.js";

const useRestFallback = () => !hasDatabaseConfig && hasSupabaseRestConfig;

const productSelect = `
  product_id,
  product_uuid,
  sku,
  product_name,
  unit,
  category,
  category_id,
  barcode,
  supplier,
  warehouse_location,
  unit_price,
  currency_code,
  inventory_on_hand,
  created_at
`;

const pricingSelect = `
  pricing_id,
  product_id,
  cost_price,
  selling_price,
  currency_code,
  effective_from,
  effective_to,
  created_at,
  created_by,
  updated_at,
  updated_by,
  is_active
`;

const mapProductRow = (row, inventoryByProductId = new Map()) => {
  const inventory = inventoryByProductId.get(String(row.product_id));
  return {
    product_id: row.product_id,
    product_uuid: row.product_uuid ?? null,
    sku: row.sku ?? "",
    product_name: row.product_name ?? "",
    unit: row.unit ?? null,
    category: row.category ?? null,
    category_id: row.category_id ?? null,
    barcode: row.barcode ?? "",
    supplier: row.supplier ?? "",
    warehouse_location: row.warehouse_location ?? "",
    unit_price: Number(row.unit_price ?? 0),
    currency_code: row.currency_code ?? "PHP",
    inventory_on_hand: Number(
      inventory?.qty_on_hand ?? row.inventory_on_hand ?? 0,
    ),
    inventory_updated_at: inventory?.updated_at ?? null,
    created_at: row.created_at ?? null,
  };
};

const mapPricingRow = (row) => ({
  pricing_id: row.pricing_id,
  product_id: row.product_id,
  cost_price: Number(row.cost_price ?? 0),
  selling_price: Number(row.selling_price ?? 0),
  currency_code: row.currency_code ?? "PHP",
  effective_from: row.effective_from ?? null,
  effective_to: row.effective_to ?? null,
  created_at: row.created_at ?? null,
  created_by: row.created_by ?? null,
  updated_at: row.updated_at ?? null,
  updated_by: row.updated_by ?? null,
  is_active: row.is_active ?? null,
});

export const listProducts = async (pagination) => {
  if (useRestFallback()) {
    return listProductsRest(pagination);
  }

  const pool = getPool();
  const params = [];
  const conditions = [];

  if (pagination.search) {
    params.push(`%${pagination.search}%`);
    conditions.push(
      `(sku ILIKE $${params.length} OR product_name ILIKE $${params.length} OR barcode ILIKE $${params.length})`,
    );
  }

  params.push(pagination.limit, pagination.offset);
  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [productsResult, inventoryResult] = await Promise.all([
    pool.query(
      `
        SELECT ${productSelect}
        FROM products
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    ),
    pool.query(
      `
        SELECT product_id, qty_on_hand, updated_at
        FROM v_products_with_inventory
      `,
    ),
  ]);

  const inventoryByProductId = new Map(
    inventoryResult.rows.map((row) => [
      String(row.product_id),
      {
        qty_on_hand: Number(row.qty_on_hand ?? 0),
        updated_at: row.updated_at ?? null,
      },
    ]),
  );

  return productsResult.rows.map((row) =>
    mapProductRow(row, inventoryByProductId),
  );
};

export const getProductById = async (productId) => {
  if (useRestFallback()) {
    const product = await getProductByIdRest(productId);
    if (!product) {
      throw createHttpError(404, "Product not found");
    }
    return product;
  }

  const pool = getPool();
  const [productResult, inventoryResult] = await Promise.all([
    pool.query(
      `
        SELECT ${productSelect}
        FROM products
        WHERE product_id = $1
        LIMIT 1
      `,
      [productId],
    ),
    pool.query(
      `
        SELECT product_id, qty_on_hand, updated_at
        FROM v_products_with_inventory
        WHERE product_id = $1
      `,
      [productId],
    ),
  ]);

  const row = productResult.rows[0];
  if (!row) {
    throw createHttpError(404, "Product not found");
  }

  const inventoryByProductId = new Map(
    inventoryResult.rows.map((inventoryRow) => [
      String(inventoryRow.product_id),
      {
        qty_on_hand: Number(inventoryRow.qty_on_hand ?? 0),
        updated_at: inventoryRow.updated_at ?? null,
      },
    ]),
  );

  return mapProductRow(row, inventoryByProductId);
};

export const listCategories = async () => {
  if (useRestFallback()) {
    return listCategoriesRest();
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT id, name, parent_id
      FROM product_categories
      ORDER BY name ASC
    `,
  );

  return result.rows;
};

export const listPricingHistory = async () => {
  if (useRestFallback()) {
    const rows = await listPricingHistoryRest();
    return rows.map(mapPricingRow);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${pricingSelect}
      FROM product_pricing
      ORDER BY effective_from DESC NULLS LAST, created_at DESC NULLS LAST
    `,
  );

  return result.rows.map(mapPricingRow);
};

export const createProduct = async (payload) => {
  if (useRestFallback()) {
    return createProductRest(payload);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `
        INSERT INTO products (
          sku,
          product_name,
          category_id,
          category,
          unit,
          barcode,
          supplier,
          warehouse_location,
          unit_price,
          currency_code,
          inventory_on_hand,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()))
        RETURNING ${productSelect}
      `,
      [
        payload.sku,
        payload.product_name,
        payload.category_id,
        payload.category ?? null,
        payload.unit ?? "pcs",
        payload.barcode,
        payload.supplier,
        payload.warehouse_location,
        payload.unit_price ?? 0,
        payload.currency_code ?? "PHP",
        payload.inventory_on_hand ?? 0,
        payload.created_at,
      ],
    );

    const row = productResult.rows[0];
    const productKey = row.product_uuid || row.product_id;

    const binLookup = await client.query(
      `
        SELECT bin_id
        FROM inventory_on_hand
        LIMIT 1
      `,
    );
    let binId = binLookup.rows[0]?.bin_id ?? null;

    if (!binId) {
      const binsResult = await client.query(
        `
          SELECT id
          FROM bins
          LIMIT 1
        `,
      );
      binId = binsResult.rows[0]?.id ?? null;
    }

    if (binId) {
      await client.query(
        `
          INSERT INTO inventory_on_hand (product_id, bin_id, qty_on_hand)
          VALUES ($1, $2, $3)
        `,
        [productKey, binId, payload.inventory_on_hand ?? 0],
      );
    }

    await client.query(
      `
        INSERT INTO product_pricing (
          product_id,
          cost_price,
          selling_price,
          currency_code,
          effective_from,
          is_active,
          created_by
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE, true, $5)
      `,
      [
        row.product_id,
        payload.cost_price ?? 0,
        payload.unit_price ?? 0,
        payload.currency_code ?? "PHP",
        "product_catalog_service",
      ],
    );

    await client.query("COMMIT");
    return mapProductRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateProduct = async (productId, payload) => {
  if (useRestFallback()) {
    return updateProductRest(productId, payload);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const columnMap = {
      product_name: "product_name",
      category_id: "category_id",
      category: "category",
      unit: "unit",
      barcode: "barcode",
      supplier: "supplier",
      warehouse_location: "warehouse_location",
      unit_price: "unit_price",
      currency_code: "currency_code",
      inventory_on_hand: "inventory_on_hand",
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
      throw createHttpError(400, "No valid product fields provided");
    }

    values.push(productId);

    const productResult = await client.query(
      `
        UPDATE products
        SET ${updates.join(", ")}
        WHERE product_id = $${values.length}
        RETURNING ${productSelect}
      `,
      values,
    );

    const row = productResult.rows[0];
    if (!row) {
      throw createHttpError(404, "Product not found");
    }

    if ("inventory_on_hand" in payload) {
      const productKey = row.product_uuid || row.product_id;
      const existingInventory = await client.query(
        `
          SELECT product_id, bin_id
          FROM inventory_on_hand
          WHERE product_id = $1
          LIMIT 1
        `,
        [productKey],
      );

      if (existingInventory.rows[0]) {
        await client.query(
          `
            UPDATE inventory_on_hand
            SET qty_on_hand = $1
            WHERE product_id = $2 AND bin_id = $3
          `,
          [
            payload.inventory_on_hand,
            existingInventory.rows[0].product_id,
            existingInventory.rows[0].bin_id,
          ],
        );
      }
    }

    if (
      "cost_price" in payload ||
      "unit_price" in payload ||
      "currency_code" in payload
    ) {
      await client.query(
        `
          UPDATE product_pricing
          SET is_active = false,
              effective_to = CURRENT_DATE,
              updated_at = NOW(),
              updated_by = $2
          WHERE product_id = $1
            AND is_active = true
        `,
        [row.product_id, "product_catalog_service"],
      );

      await client.query(
        `
          INSERT INTO product_pricing (
            product_id,
            cost_price,
            selling_price,
            currency_code,
            effective_from,
            is_active,
            created_by
          )
          VALUES ($1, $2, $3, $4, CURRENT_DATE, true, $5)
        `,
        [
          row.product_id,
          payload.cost_price ?? 0,
          payload.unit_price ?? row.unit_price ?? 0,
          payload.currency_code ?? row.currency_code ?? "PHP",
          "product_catalog_service",
        ],
      );
    }

    await client.query("COMMIT");
    return mapProductRow(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteProduct = async (productId) => {
  if (useRestFallback()) {
    return deleteProductRest(productId);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productResult = await client.query(
      `
        SELECT product_id, product_uuid
        FROM products
        WHERE product_id = $1
        LIMIT 1
      `,
      [productId],
    );

    const row = productResult.rows[0];
    if (!row) {
      throw createHttpError(404, "Product not found");
    }

    const productKey = row.product_uuid || row.product_id;

    await client.query(
      `
        DELETE FROM inventory_on_hand
        WHERE product_id = $1
      `,
      [productKey],
    );

    await client.query(
      `
        DELETE FROM products
        WHERE product_id = $1
      `,
      [productId],
    );

    await client.query("COMMIT");
    return { product_id: productId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const importProducts = async (products) => {
  if (useRestFallback()) {
    return importProductsRest(products);
  }

  const created = [];
  for (const product of products) {
    created.push(await createProduct(product));
  }
  return created;
};
