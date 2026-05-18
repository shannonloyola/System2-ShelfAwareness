import { getPool } from '../lib/database.js';
import { supabaseFulfillment } from '../lib/supabaseClient.js';

const isValidUuid = (str) => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
};

/**
 * Fetch a single shipment by ID from the `shipments` table.
 * (Note: Using shipment_id as the primary identifier)
 */
export const getShipmentByTracking = async (trackingOrId) => {
  if (!trackingOrId) return null;

  const pool = getPool();
  const isUuid = isValidUuid(trackingOrId);

  if (!pool) {
    console.log('[SUPABASE] Querying shipment by tracking/ID:', trackingOrId);
    const query = supabaseFulfillment.from('shipments').select('*');
    if (isUuid) {
      query.eq('shipment_id', trackingOrId);
    } else {
      query.eq('tracking_number', trackingOrId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('[SUPABASE] getShipmentByTracking error:', error);
      throw error;
    }
    if (!data) return null;
    return { id: data.shipment_id, tracking_number: data.tracking_number || data.shipment_id, ...data };
  }

  const queryStr = isUuid
    ? 'SELECT shipment_id as id, tracking_number, * FROM shipments WHERE shipment_id = $1 LIMIT 1'
    : 'SELECT shipment_id as id, tracking_number, * FROM shipments WHERE tracking_number = $1 LIMIT 1';

  const result = await pool.query(queryStr, [trackingOrId]);
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.shipment_id, tracking_number: row.tracking_number || row.shipment_id, ...row };
};

/**
 * Fetch all shipments with active/pending status.
 * (Note: Mapping 'initialized' and 'handed_to_freight' as pending)
 */
export const getPendingShipments = async () => {
  const pool = getPool();
  if (!pool) {
    console.log('[SUPABASE] Fetching pending shipments...');
    const { data, error } = await supabaseFulfillment
      .from('shipments')
      .select('*')
      .in('status', ['pending', 'initialized', 'handed_to_freight'])
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[SUPABASE] getPendingShipments error:', error);
      throw error;
    }
    return (data || []).map(d => ({ id: d.shipment_id, tracking_number: d.tracking_number || d.shipment_id, ...d }));
  }

  const result = await pool.query(
    "SELECT shipment_id as id, tracking_number, * FROM shipments WHERE status IN ('pending', 'initialized', 'handed_to_freight') ORDER BY created_at ASC"
  );
  return (result.rows || []).map(row => ({ id: row.shipment_id, tracking_number: row.tracking_number || row.shipment_id, ...row }));
};

/**
 * Count shipments received today.
 */
export const getTodayReceivedCount = async () => {
  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];

  if (!pool) {
    console.log('[SUPABASE] Counting today\'s received shipments...');
    const { data, error } = await supabaseFulfillment
      .from('shipments')
      .select('shipment_id')
      .eq('status', 'received')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);
    if (error) {
      console.error('[SUPABASE] getTodayReceivedCount error:', error);
      throw error;
    }
    return data ? data.length : 0;
  }

  const result = await pool.query(
    "SELECT COUNT(*) FROM shipments WHERE status = 'received' AND created_at >= $1 AND created_at < $2",
    [`${today}T00:00:00`, `${today}T23:59:59`]
  );
  return parseInt(result.rows[0].count, 10) || 0;
};

/**
 * Update a shipment's status (e.g., mark as 'received').
 */
export const updateShipmentStatus = async ({ id, status, receivedBy, notes }) => {
  if (!isValidUuid(id)) {
    console.log('[REPO] updateShipmentStatus: Invalid UUID format, returning null directly:', id);
    return null;
  }

  const pool = getPool();
  const updatedAt = new Date().toISOString();

  if (!pool) {
    console.log('[SUPABASE] Updating shipment status in Supabase:', id, status);
    const updateObj = { status };

    const { data, error } = await supabaseFulfillment
      .from('shipments')
      .update(updateObj)
      .eq('shipment_id', id)
      .select()
      .maybeSingle();
    if (error) {
      console.error('[SUPABASE] updateShipmentStatus error:', error);
      throw error;
    }
    if (!data) return null;
    return { id: data.shipment_id, tracking_number: data.tracking_number || data.shipment_id, ...data };
  }
  
  const result = await pool.query(
    `UPDATE shipments 
     SET status = $1, notes = COALESCE($2, notes), updated_at = $3
     WHERE shipment_id = $4
     RETURNING *`,
    [status, notes || null, updatedAt, id]
  );

  return result.rows[0];
};
