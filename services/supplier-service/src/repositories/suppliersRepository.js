import { getPool, hasDatabaseConfig, hasSupabaseRestConfig } from "../lib/database.js";
import { createHttpError } from "../lib/http.js";
import {
  createSupplierRest,
  deleteSupplierRest,
  getSupplierByIdRest,
  listSuppliersRest,
  updateSupplierRest,
} from "../lib/supabaseRest.js";

const baseSelect = `
  id,
  supplier_name,
  contact_person,
  email,
  phone,
  address,
  currency_code,
  lead_time_days,
  status,
  created_at,
  updated_at
`;

const mapSupplierRow = (row) => ({
  id: row.id,
  supplier_name: row.supplier_name,
  contact_person: row.contact_person,
  email: row.email,
  phone: row.phone,
  address: row.address,
  currency_code: row.currency_code,
  lead_time_days: row.lead_time_days,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getSupplierByIdQuery = `
  SELECT ${baseSelect}
  FROM suppliers
  WHERE id = $1
`;

export const listSuppliers = async ({ limit, offset, search }) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    return listSuppliersRest({ limit, offset, search });
  }

  const pool = getPool();
  const params = [];
  let whereClause = "";

  if (search) {
    params.push(`%${search}%`);
    whereClause += `
      WHERE (
        supplier_name ILIKE $${params.length}
        OR COALESCE(contact_person, '') ILIKE $${params.length}
        OR COALESCE(email, '') ILIKE $${params.length}
      )
    `;
  }

  params.push(limit, offset);

  const result = await pool.query(
    `
      SELECT ${baseSelect}
      FROM suppliers
      ${whereClause}
      ORDER BY supplier_name ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    params,
  );

  return result.rows.map(mapSupplierRow);
};

export const getSupplierById = async (supplierId) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    const supplier = await getSupplierByIdRest(supplierId);

    if (!supplier) {
      throw createHttpError(404, "Supplier not found");
    }

    return supplier;
  }

  const pool = getPool();
  const result = await pool.query(getSupplierByIdQuery, [supplierId]);
  const row = result.rows[0];

  if (!row) {
    throw createHttpError(404, "Supplier not found");
  }

  return mapSupplierRow(row);
};

export const getSupplierByName = async (supplierName) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    const suppliers = await listSuppliersRest({
      limit: 100,
      offset: 0,
      search: supplierName,
    });
    const match = suppliers.find(
      (supplier) =>
        String(supplier.supplier_name || "").trim().toLowerCase() ===
        supplierName.trim().toLowerCase(),
    );

    if (!match) {
      throw createHttpError(404, "Supplier not found");
    }

    return match;
  }

  const pool = getPool();
  const result = await pool.query(
    `
      SELECT ${baseSelect}
      FROM suppliers
      WHERE LOWER(supplier_name) = LOWER($1)
      LIMIT 1
    `,
    [supplierName],
  );
  const row = result.rows[0];

  if (!row) {
    throw createHttpError(404, "Supplier not found");
  }

  return mapSupplierRow(row);
};

export const createSupplier = async (payload) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    return createSupplierRest(payload);
  }

  const pool = getPool();
  const result = await pool.query(
    `
      INSERT INTO suppliers (
        supplier_name,
        contact_person,
        email,
        phone,
        address,
        currency_code,
        lead_time_days,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${baseSelect}
    `,
    [
      payload.supplier_name,
      payload.contact_person,
      payload.email,
      payload.phone,
      payload.address,
      payload.currency_code,
      payload.lead_time_days,
      payload.status,
    ],
  );

  return mapSupplierRow(result.rows[0]);
};

export const updateSupplier = async (supplierId, payload) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    const supplier = await updateSupplierRest(supplierId, payload);

    if (!supplier) {
      throw createHttpError(404, "Supplier not found");
    }

    return supplier;
  }

  const pool = getPool();
  const columnMap = {
    supplier_name: "supplier_name",
    contact_person: "contact_person",
    email: "email",
    phone: "phone",
    address: "address",
    currency_code: "currency_code",
    lead_time_days: "lead_time_days",
    status: "status",
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
    throw createHttpError(400, "No valid supplier fields provided");
  }

  values.push(supplierId);

  const result = await pool.query(
    `
      UPDATE suppliers
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING ${baseSelect}
    `,
    values,
  );

  const row = result.rows[0];
  if (!row) {
    throw createHttpError(404, "Supplier not found");
  }

  return mapSupplierRow(row);
};

export const deleteSupplier = async (supplierId) => {
  if (!hasDatabaseConfig && hasSupabaseRestConfig) {
    const deleted = await deleteSupplierRest(supplierId);

    if (!deleted) {
      throw createHttpError(404, "Supplier not found");
    }

    return { id: deleted.id };
  }

  const pool = getPool();
  const result = await pool.query(
    `
      UPDATE suppliers
      SET updated_at = NOW(), status = 'Suspended'
      WHERE id = $1
      RETURNING id
    `,
    [supplierId],
  );

  if (!result.rows[0]) {
    throw createHttpError(404, "Supplier not found");
  }

  return { id: result.rows[0].id };
};
