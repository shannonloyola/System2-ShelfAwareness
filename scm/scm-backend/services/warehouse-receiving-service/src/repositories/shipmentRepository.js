import { getPool } from '../lib/database.js';

/**
 * Fetch a single shipment by ID from the `shipments` table.
 * (Note: Using shipment_id as the primary identifier)
 */
export const getShipmentByTracking = async (id) => {
  const pool = getPool();
  const result = await pool.query(
    'SELECT shipment_id as id, shipment_id as tracking_number, * FROM shipments WHERE shipment_id = $1 LIMIT 1',
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Fetch all shipments with active/pending status.
 * (Note: Mapping 'initialized' and 'handed_to_freight' as pending)
 */
export const getPendingShipments = async () => {
  const pool = getPool();
  const result = await pool.query(
    "SELECT shipment_id as id, shipment_id as tracking_number, * FROM shipments WHERE status IN ('initialized', 'handed_to_freight') ORDER BY created_at ASC"
  );
  return result.rows || [];
};

/**
 * Count shipments received today.
 */
export const getTodayReceivedCount = async () => {
  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];
  const result = await pool.query(
    "SELECT COUNT(*) FROM shipments WHERE status = 'received' AND updated_at >= $1 AND updated_at < $2",
    [`${today}T00:00:00`, `${today}T23:59:59`]
  );
  return parseInt(result.rows[0].count, 10) || 0;
};

/**
 * Update a shipment's status (e.g., mark as 'received').
 */
export const updateShipmentStatus = async ({ id, status, receivedBy, notes }) => {
  const pool = getPool();
  const updatedAt = new Date().toISOString();
  
  const result = await pool.query(
    `UPDATE shipments 
     SET status = $1, notes = COALESCE($2, notes), updated_at = $3
     WHERE shipment_id = $4
     RETURNING *`,
    [status, notes || null, updatedAt, id]
  );

  return result.rows[0];
};
