import { getPool } from '../lib/database.js';
import { supabaseFulfillment, supabaseSCM } from '../lib/supabaseClient.js';

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
    console.log('[SUPABASE] Counting today\'s received shipments by received_at...');
    const { data, error } = await supabaseFulfillment
      .from('shipments')
      .select('shipment_id')
      .eq('status', 'received')
      .gte('received_at', `${today}T00:00:00`)
      .lt('received_at', `${today}T23:59:59`);
    if (error) {
      console.error('[SUPABASE] getTodayReceivedCount error:', error);
      throw error;
    }
    return data ? data.length : 0;
  }

  const result = await pool.query(
    "SELECT COUNT(*) FROM shipments WHERE status = 'received' AND received_at >= $1 AND received_at < $2",
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

  let updatedRow = null;

  if (!pool) {
    console.log('[SUPABASE] Updating shipment status in Supabase:', id, status);
    const updateObj = { status, updated_at: updatedAt };
    if (status === 'received') {
      updateObj.received_at = new Date().toISOString();
      if (receivedBy) updateObj.received_by = receivedBy;
      if (notes) updateObj.notes = notes;
    } else {
      if (notes) updateObj.notes = notes;
    }

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
    updatedRow = data;
  } else {
    if (status === 'received') {
      const receivedAt = new Date().toISOString();
      const result = await pool.query(
        `UPDATE shipments 
         SET status = $1, notes = COALESCE($2, notes), received_at = $3, received_by = COALESCE($4, received_by), updated_at = $5
         WHERE shipment_id = $6
         RETURNING *`,
        [status, notes || null, receivedAt, receivedBy || null, updatedAt, id]
      );
      updatedRow = result.rows[0];
    } else {
      const result = await pool.query(
        `UPDATE shipments 
         SET status = $1, notes = COALESCE($2, notes), updated_at = $3
         WHERE shipment_id = $4
         RETURNING *`,
        [status, notes || null, updatedAt, id]
      );
      updatedRow = result.rows[0];
    }
  }

  if (!updatedRow) return null;

  const finalShipment = {
    id: updatedRow.shipment_id,
    tracking_number: updatedRow.tracking_number || updatedRow.shipment_id,
    ...updatedRow,
  };

  // Cross-Service Sync: Update SCM Purchase Order status and transit_status
  if (status === 'received') {
    const poId = updatedRow.po_id;
    const poNo = updatedRow.po_no;
    
    if (poId) {
      console.log('[SUPABASE] Marking Purchase Order as received by po_id:', poId);
      const { error: poError } = await supabaseSCM
        .from('purchase_orders')
        .update({
          status: 'Received',
          transit_status: 'received',
          transit_updated_at: new Date().toISOString(),
          transit_updated_by: receivedBy || 'Warehouse Mobile',
          transit_notes: notes || 'Received via Warehouse Mobile App'
        })
        .eq('po_id', poId);

      if (poError) {
        console.error('[SUPABASE] Error updating purchase order received status by po_id:', poError);
      }
    } else if (poNo) {
      console.log('[SUPABASE] Marking Purchase Order as received by po_no:', poNo);
      const { error: poError } = await supabaseSCM
        .from('purchase_orders')
        .update({
          status: 'Received',
          transit_status: 'received',
          transit_updated_at: new Date().toISOString(),
          transit_updated_by: receivedBy || 'Warehouse Mobile',
          transit_notes: notes || 'Received via Warehouse Mobile App'
        })
        .eq('po_no', poNo);

      if (poError) {
        console.error('[SUPABASE] Error updating purchase order received status by po_no:', poError);
      }
    }
  }

  return finalShipment;
};

/**
 * Fetch received shipments, with optional date filtering.
 */
export const getReceivedShipments = async ({ date } = {}) => {
  const pool = getPool();
  const today = date === 'today' ? new Date().toISOString().split('T')[0] : null;

  if (!pool) {
    console.log('[SUPABASE] Fetching received shipments...');
    let query = supabaseFulfillment
      .from('shipments')
      .select('*')
      .eq('status', 'received')
      .order('received_at', { ascending: false });

    if (today) {
      query = query
        .gte('received_at', `${today}T00:00:00`)
        .lt('received_at', `${today}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[SUPABASE] getReceivedShipments error:', error);
      throw error;
    }
    return (data || []).map(d => ({ id: d.shipment_id, tracking_number: d.tracking_number || d.shipment_id, ...d }));
  }

  let queryStr = "SELECT shipment_id as id, tracking_number, * FROM shipments WHERE status = 'received'";
  const params = [];
  if (today) {
    queryStr += " AND received_at >= $1 AND received_at < $2";
    params.push(`${today}T00:00:00`, `${today}T23:59:59`);
  }
  queryStr += " ORDER BY received_at DESC";

  const result = await pool.query(queryStr, params);
  return (result.rows || []).map(row => ({ id: row.shipment_id, tracking_number: row.tracking_number || row.shipment_id, ...row }));
};
