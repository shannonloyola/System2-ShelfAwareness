-- Demo seed: Fulfillment project
-- Run this in Supabase project: dkqvbyewfyzfmisyisgs
-- Supports: Dashboard, PO List, Warehouse Receiving, Stock Management, Inventory Count

begin;

-- 1) Bins and locations for stock transfer + inventory screens
insert into public.bins (name)
select seed.name
from (
  values
    ('MAIN-PHARMACY-01'),
    ('MAIN-PHARMACY-02'),
    ('COLD-ROOM-01'),
    ('FAST-MOVING-01'),
    ('QUARANTINE-01')
) as seed(name)
where not exists (
  select 1 from public.bins b where lower(b.name) = lower(seed.name)
);

insert into public.zones (zone_code, weekly_stock_count)
select seed.zone_code, seed.weekly_stock_count
from (
  values
    ('A', true),
    ('B', true),
    ('C', false),
    ('COLD', true),
    ('QTN', false)
) as seed(zone_code, weekly_stock_count)
where not exists (
  select 1 from public.zones z where z.zone_code = seed.zone_code
);

insert into public.locations (zone, aisle, bin, location_type)
select *
from (
  values
    ('A', '01', '001', 'STORAGE'),
    ('A', '01', '002', 'STORAGE'),
    ('B', '02', '005', 'STORAGE'),
    ('COLD', '01', '001', 'COLD_STORAGE'),
    ('QTN', '01', '001', 'QUARANTINE')
) as seed(zone, aisle, bin, location_type)
where not exists (
  select 1
  from public.locations l
  where l.zone = seed.zone
    and l.aisle = seed.aisle
    and l.bin = seed.bin
);

-- 1b) Physical counts table used by Inventory Count screen
create table if not exists public.physical_counts (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  sku text not null,
  product_name text,
  physical_count integer not null,
  counted_by text,
  created_at timestamptz default now(),
  created_by uuid,
  import_source text
);

-- 2) Fulfillment-side products used by inventory count and warehouse screens
insert into public.products (
  sku,
  product_name,
  category,
  warehouse_location,
  unit_price,
  currency_code
)
select *
from (
  values
    ('AMOX-500-CAP', 'Amoxicillin 500mg Capsule', 'Antibiotics', 'MAIN-PHARMACY-01', 18.75, 'PHP'),
    ('AZI-500-TAB', 'Azithromycin 500mg Tablet', 'Antibiotics', 'MAIN-PHARMACY-01', 42.50, 'PHP'),
    ('PARA-500-TAB', 'Paracetamol 500mg Tablet', 'Analgesics', 'MAIN-PHARMACY-02', 2.85, 'PHP'),
    ('LOSA-50-TAB', 'Losartan 50mg Tablet', 'Maintenance Medicines', 'FAST-MOVING-01', 7.50, 'PHP'),
    ('AMLO-5-TAB', 'Amlodipine 5mg Tablet', 'Maintenance Medicines', 'FAST-MOVING-01', 6.20, 'PHP'),
    ('METF-500-TAB', 'Metformin 500mg Tablet', 'Diabetes Care', 'MAIN-PHARMACY-02', 3.95, 'PHP'),
    ('INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 'Cold Chain', 'COLD-ROOM-01', 1380.00, 'PHP'),
    ('SYR-10ML', 'Syringe 10mL Sterile', 'Consumables', 'MAIN-PHARMACY-02', 12.50, 'PHP'),
    ('GLOVES-NIT-M', 'Nitrile Gloves Medium', 'Consumables', 'MAIN-PHARMACY-02', 185.00, 'PHP'),
    ('THERM-DIGI', 'Digital Thermometer', 'Devices', 'FAST-MOVING-01', 420.00, 'PHP')
) as seed(sku, product_name, category, warehouse_location, unit_price, currency_code)
where not exists (
  select 1 from public.products p where lower(p.sku) = lower(seed.sku)
);

-- 3) On-hand balances by bin
with seed_inventory as (
  select *
  from (
    values
      ('AMOX-500-CAP', 'MAIN-PHARMACY-01', 420),
      ('AZI-500-TAB', 'MAIN-PHARMACY-01', 96),
      ('PARA-500-TAB', 'MAIN-PHARMACY-02', 2860),
      ('LOSA-50-TAB', 'FAST-MOVING-01', 58),
      ('AMLO-5-TAB', 'FAST-MOVING-01', 80),
      ('METF-500-TAB', 'MAIN-PHARMACY-02', 1240),
      ('INS-GLAR-100-PEN', 'COLD-ROOM-01', 18),
      ('SYR-10ML', 'MAIN-PHARMACY-02', 1900),
      ('GLOVES-NIT-M', 'MAIN-PHARMACY-02', 250),
      ('THERM-DIGI', 'FAST-MOVING-01', 22)
  ) as seed(sku, bin_name, qty_on_hand)
)
insert into public.inventory_on_hand (product_id, qty_on_hand, bin_id, updated_at, sku)
select p.product_id, si.qty_on_hand, b.id, '2026-05-19 18:00+08'::timestamptz, p.sku
from seed_inventory si
join public.products p on lower(p.sku) = lower(si.sku)
join public.bins b on lower(b.name) = lower(si.bin_name)
where not exists (
  select 1
  from public.inventory_on_hand ioh
  where ioh.product_id = p.product_id
    and ioh.bin_id = b.id
);

-- 4) Inventory movement history for movement reports
insert into public.inventory_movements (
  product_id,
  movement_type,
  qty,
  reference,
  stock_before,
  stock_after,
  created_at,
  created_by,
  sku,
  product_name,
  direction,
  notes
)
select
  p.product_id,
  seed.movement_type,
  seed.qty,
  seed.reference,
  seed.stock_before,
  seed.stock_after,
  seed.created_at,
  seed.created_by,
  p.sku,
  p.product_name,
  seed.direction,
  seed.notes
from (
  values
    ('AMOX-500-CAP', 'GRN_RECEIPT', 1200, 'GRN-MAY26-001', 0, 1200, '2026-05-09 15:30+08'::timestamptz, 'Warehouse Demo', 'IN', 'Initial inbound receipt'),
    ('AMOX-500-CAP', 'SALES_FULFILLMENT', 780, 'RO-MAY26-001', 1200, 420, '2026-05-10 09:20+08'::timestamptz, 'Warehouse Demo', 'OUT', 'Retail order pick and dispatch'),
    ('PARA-500-TAB', 'GRN_RECEIPT', 3000, 'GRN-MAY26-001', 0, 3000, '2026-05-09 15:35+08'::timestamptz, 'Warehouse Demo', 'IN', 'Inbound receipt'),
    ('PARA-500-TAB', 'CYCLE_COUNT', -140, 'COUNT-MAY26-002', 3000, 2860, '2026-05-18 17:10+08'::timestamptz, 'Inventory Counter', 'OUT', 'Count correction after shelf recount'),
    ('LOSA-50-TAB', 'SALES_FULFILLMENT', -17, 'RO-MAY26-001', 75, 58, '2026-05-10 09:40+08'::timestamptz, 'Warehouse Demo', 'OUT', 'Partial fulfillment left a backorder'),
    ('INS-GLAR-100-PEN', 'GRN_RECEIPT', 22, 'GRN-MAY26-004', 0, 22, '2026-05-18 10:20+08'::timestamptz, 'Warehouse Demo', 'IN', 'Cold-chain intake'),
    ('INS-GLAR-100-PEN', 'QC_HOLD', -4, 'DISC-MAY26-004', 22, 18, '2026-05-18 10:40+08'::timestamptz, 'QC Demo', 'OUT', 'Units quarantined for variance review'),
    ('THERM-DIGI', 'TRANSFER', 6, 'XFER-MAY26-001', 16, 22, '2026-05-19 11:00+08'::timestamptz, 'Warehouse Demo', 'IN', 'Rebalanced to fast-moving area')
) as seed(
  sku, movement_type, qty, reference, stock_before, stock_after, created_at,
  created_by, direction, notes
)
join public.products p on lower(p.sku) = lower(seed.sku)
where not exists (
  select 1
  from public.inventory_movements im
  where im.reference = seed.reference
    and lower(im.sku) = lower(seed.sku)
);

-- 5) PO-linked receiving schedule + shipments
insert into public.delivery_schedules (
  id,
  delivery_datetime,
  supplier_name,
  expected_items_count,
  warehouse_location,
  status
)
select *
from (
  values
    ('DS-MAY26-001', '2026-05-09 13:30+08'::timestamptz, 'HealthMed Supply', 2, 'Receiving Bay 1', 'received'),
    ('DS-MAY26-004', '2026-05-18 08:30+08'::timestamptz, 'ColdChain Rx Logistics', 1, 'Cold Chain Dock', 'arrived'),
    ('DS-MAY26-006', '2026-05-26 10:00+08'::timestamptz, 'Summit Biocare', 2, 'Receiving Bay 2', 'scheduled')
) as seed(id, delivery_datetime, supplier_name, expected_items_count, warehouse_location, status)
where not exists (
  select 1 from public.delivery_schedules ds where ds.id = seed.id
);

insert into public.shipments (
  po_id,
  status,
  freight_type,
  estimated_days,
  created_at,
  po_no,
  supplier_name,
  expected_items,
  tracking_number
)
select *
from (
  values
    ('00000000-0000-0000-0000-000000000001'::uuid, 'received', 'Air', 7, '2026-05-05 09:00+08'::timestamptz, 'PO-MAY26-001', 'HealthMed Supply', '[{"sku":"AMOX-500-CAP","qty":1200},{"sku":"PARA-500-TAB","qty":3000}]'::jsonb, 'TRK-MAY26-001'),
    ('00000000-0000-0000-0000-000000000004'::uuid, 'quality_check', 'Air', 5, '2026-05-15 10:10+08'::timestamptz, 'PO-MAY26-004', 'ColdChain Rx Logistics', '[{"sku":"INS-GLAR-100-PEN","qty":180}]'::jsonb, 'TRK-MAY26-004'),
    ('00000000-0000-0000-0000-000000000006'::uuid, 'scheduled', 'Air', 4, '2026-05-20 08:30+08'::timestamptz, 'PO-MAY26-006', 'Summit Biocare', '[{"sku":"SYR-10ML","qty":2200},{"sku":"GLOVES-NIT-M","qty":180}]'::jsonb, 'TRK-MAY26-006')
) as seed(po_id, status, freight_type, estimated_days, created_at, po_no, supplier_name, expected_items, tracking_number)
where not exists (
  select 1 from public.shipments s where s.tracking_number = seed.tracking_number
);

-- 6) GRN headers/lines and drafts for warehouse receiving
insert into public.grn_headers (
  grn_reference,
  received_date,
  status,
  notes,
  created_by,
  created_at
)
select *
from (
  values
    ('GRN-MAY26-001', '2026-05-09'::date, 'posted', 'Routine replenishment received complete', 'warehouse@test.com', '2026-05-09 15:20+08'::timestamptz),
    ('GRN-MAY26-004', '2026-05-18'::date, 'pending_review', 'Cold-chain shipment with QC hold', 'warehouse@test.com', '2026-05-18 10:10+08'::timestamptz)
) as seed(grn_reference, received_date, status, notes, created_by, created_at)
where not exists (
  select 1 from public.grn_headers gh where gh.grn_reference = seed.grn_reference
);

insert into public.grn_lines (
  header_id,
  line_no,
  product_sku,
  product_name,
  qty_expected,
  qty_received,
  discrepancy_reason
)
select gh.id, seed.line_no, seed.product_sku, seed.product_name, seed.qty_expected, seed.qty_received, seed.discrepancy_reason
from (
  values
    ('GRN-MAY26-001', 1, 'AMOX-500-CAP', 'Amoxicillin 500mg Capsule', 1200, 1200, null),
    ('GRN-MAY26-001', 2, 'PARA-500-TAB', 'Paracetamol 500mg Tablet', 3000, 3000, null),
    ('GRN-MAY26-004', 1, 'INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 180, 176, 'Temperature excursion under review')
) as seed(grn_reference, line_no, product_sku, product_name, qty_expected, qty_received, discrepancy_reason)
join public.grn_headers gh on gh.grn_reference = seed.grn_reference
where not exists (
  select 1
  from public.grn_lines gl
  where gl.header_id = gh.id
    and gl.line_no = seed.line_no
);

insert into public.grn_drafts (
  grn_number,
  status,
  received_date,
  has_discrepancy,
  notes,
  posted_by,
  posted_at
)
select *
from (
  values
    ('GRN-DRAFT-MAY26-006', 'DRAFT', '2026-05-20'::date, false, 'Prepared for upcoming Summit Biocare receipt', null, null),
    ('GRN-DRAFT-MAY26-004A', 'POSTED', '2026-05-18'::date, true, 'Posted with discrepancy hold', 'warehouse@test.com', '2026-05-18 10:30+08'::timestamptz)
) as seed(grn_number, status, received_date, has_discrepancy, notes, posted_by, posted_at)
where not exists (
  select 1 from public.grn_drafts gd where gd.grn_number = seed.grn_number
);

insert into public.grn_draft_lines (
  grn_draft_id,
  product_id,
  sku,
  qty_expected,
  qty_received,
  variance,
  line_no,
  batch_number,
  expiry_date,
  discrepancy_reason,
  product_name
)
select
  gd.id,
  p.product_id::text,
  seed.sku,
  seed.qty_expected,
  seed.qty_received,
  seed.variance,
  seed.line_no,
  seed.batch_number,
  seed.expiry_date,
  seed.discrepancy_reason,
  seed.product_name
from (
  values
    ('GRN-DRAFT-MAY26-006', 'SYR-10ML', 2200, 0, 2200, 1, 'SYR0526A', '2029-05-31'::date, null, 'Syringe 10mL Sterile'),
    ('GRN-DRAFT-MAY26-006', 'GLOVES-NIT-M', 180, 0, 180, 2, 'GLV0526B', '2028-11-30'::date, null, 'Nitrile Gloves Medium'),
    ('GRN-DRAFT-MAY26-004A', 'INS-GLAR-100-PEN', 180, 176, 4, 1, 'COLD0526B', '2027-12-31'::date, 'Quarantine pending QC disposition', 'Insulin Glargine 100IU/mL Pen')
) as seed(grn_number, sku, qty_expected, qty_received, variance, line_no, batch_number, expiry_date, discrepancy_reason, product_name)
join public.grn_drafts gd on gd.grn_number = seed.grn_number
join public.products p on lower(p.sku) = lower(seed.sku)
where not exists (
  select 1
  from public.grn_draft_lines gdl
  where gdl.grn_draft_id = gd.id
    and gdl.line_no = seed.line_no
);

-- 7) QC checks written by receiving flow
insert into public.grn_quality_checks (
  grn_id,
  check_date,
  inspector_name,
  passed,
  notes,
  created_at
)
select gh.id, seed.check_date, seed.inspector_name, seed.passed, seed.notes, seed.created_at
from (
  values
    ('GRN-MAY26-001', '2026-05-09 16:00+08'::timestamptz, 'QC Inspector Demo', true, 'Seal intact and counts matched expected receipt.', '2026-05-09 16:00+08'::timestamptz),
    ('GRN-MAY26-004', '2026-05-18 10:35+08'::timestamptz, 'QC Inspector Demo', false, 'Four insulin pens isolated for variance review.', '2026-05-18 10:35+08'::timestamptz)
) as seed(grn_reference, check_date, inspector_name, passed, notes, created_at)
join public.grn_headers gh on gh.grn_reference = seed.grn_reference
where not exists (
  select 1
  from public.grn_quality_checks qc
  where qc.grn_id = gh.id
    and qc.check_date = seed.check_date
);

-- 8) Retail orders, lines, and backorders for dashboard + stock management
insert into public.retail_orders (
  order_no,
  retailer_name,
  status,
  total_amount,
  payment_terms,
  due_date,
  notes,
  priority_level,
  branch_suffix,
  priority_rank,
  created_at
)
select *
from (
  values
    ('RO-MAY26-001', 'Mercury Drug - Makati', 'approved', 28650, 'Net 15', '2026-05-23'::date, 'Critical maintenance medication replenishment', 'Urgent', 'MKT', 1, '2026-05-08 12:20+08'::timestamptz),
    ('RO-MAY26-002', 'Southstar Drug - Cebu', 'approved', 51120, 'Net 15', '2026-05-27'::date, 'Cold chain allocation pending', 'High', 'CEB', 2, '2026-05-12 09:35+08'::timestamptz),
    ('RO-MAY26-003', 'Watsons - Quezon Avenue', 'dispatched', 19400, 'Net 10', '2026-05-24'::date, 'Weekend branch top-up', 'Normal', 'QCA', 3, '2026-05-16 08:45+08'::timestamptz)
) as seed(order_no, retailer_name, status, total_amount, payment_terms, due_date, notes, priority_level, branch_suffix, priority_rank, created_at)
where not exists (
  select 1 from public.retail_orders ro where ro.order_no = seed.order_no
);

insert into public.retail_order_lines (
  order_uuid,
  sku,
  qty,
  qty_fulfilled,
  qty_backordered,
  unit_price
)
select ro.order_uuid, seed.sku, seed.qty, seed.qty_fulfilled, seed.qty_backordered, seed.unit_price
from (
  values
    ('RO-MAY26-001', 'AMOX-500-CAP', 120, 78, 42, 18.75),
    ('RO-MAY26-001', 'LOSA-50-TAB', 90, 73, 17, 7.50),
    ('RO-MAY26-002', 'INS-GLAR-100-PEN', 24, 8, 16, 1380.00),
    ('RO-MAY26-003', 'PARA-500-TAB', 400, 400, 0, 2.85)
) as seed(order_no, sku, qty, qty_fulfilled, qty_backordered, unit_price)
join public.retail_orders ro on ro.order_no = seed.order_no
where not exists (
  select 1
  from public.retail_order_lines rol
  where rol.order_uuid = ro.order_uuid
    and lower(rol.sku) = lower(seed.sku)
);

insert into public.backorders (
  sku,
  qty_needed,
  status,
  created_at,
  order_uuid,
  order_no,
  retailer_name,
  qty_backordered,
  last_alerted_at
)
select ro_line.sku, seed.qty_needed, seed.status, seed.created_at, ro.order_uuid, ro.order_no, ro.retailer_name, seed.qty_backordered, seed.last_alerted_at
from (
  values
    ('RO-MAY26-001', 'AMOX-500-CAP', 42, 'pending', '2026-05-08 12:30+08'::timestamptz, 42, '2026-05-19 09:10+08'::timestamptz),
    ('RO-MAY26-001', 'LOSA-50-TAB', 17, 'pending', '2026-05-08 12:31+08'::timestamptz, 17, '2026-05-19 09:15+08'::timestamptz),
    ('RO-MAY26-002', 'INS-GLAR-100-PEN', 16, 'pending', '2026-05-12 09:45+08'::timestamptz, 16, '2026-05-19 09:20+08'::timestamptz)
) as seed(order_no, sku, qty_needed, status, created_at, qty_backordered, last_alerted_at)
join public.retail_orders ro on ro.order_no = seed.order_no
join public.retail_order_lines ro_line on ro_line.order_uuid = ro.order_uuid and lower(ro_line.sku) = lower(seed.sku)
where not exists (
  select 1
  from public.backorders bo
  where bo.order_uuid = ro.order_uuid
    and lower(bo.sku) = lower(seed.sku)
    and bo.status = seed.status
);

insert into public.backorder_alerts (sku, grn_reference, pending_backorder_count, message, created_at)
select *
from (
  values
    ('AMOX-500-CAP', 'GRN-MAY26-001', 42, 'Amoxicillin backorders remain open after priority dispatch.', '2026-05-19 09:10+08'::timestamptz),
    ('LOSA-50-TAB', null, 17, 'Losartan backorders need replenishment from next inbound load.', '2026-05-19 09:15+08'::timestamptz),
    ('INS-GLAR-100-PEN', 'GRN-MAY26-004', 16, 'Cold-chain backorders blocked by QC quarantine.', '2026-05-19 09:20+08'::timestamptz)
) as seed(sku, grn_reference, pending_backorder_count, message, created_at)
where not exists (
  select 1
  from public.backorder_alerts ba
  where lower(ba.sku) = lower(seed.sku)
    and ba.created_at = seed.created_at
);

-- 9) Physical counts + task load for inventory count screen
insert into public.stock_count_tasks (zone_uuid, week_monday, status)
select z.zone_uuid, seed.week_monday, seed.status
from (
  values
    ('A', '2026-05-18'::date, 'open'),
    ('B', '2026-05-18'::date, 'open'),
    ('COLD', '2026-05-18'::date, 'in_progress')
) as seed(zone_code, week_monday, status)
join public.zones z on z.zone_code = seed.zone_code
where not exists (
  select 1
  from public.stock_count_tasks sct
  where sct.zone_uuid = z.zone_uuid
    and sct.week_monday = seed.week_monday
);

insert into public.physical_counts (
  product_id,
  sku,
  product_name,
  physical_count,
  counted_by,
  created_at,
  import_source
)
select
  p.product_id::text,
  p.sku,
  p.product_name,
  seed.physical_count,
  seed.counted_by,
  seed.created_at,
  seed.import_source
from (
  values
    ('PARA-500-TAB', 2860, 'Cycle Counter A', '2026-05-18 16:50+08'::timestamptz, 'manual'),
    ('LOSA-50-TAB', 58, 'Cycle Counter A', '2026-05-18 16:55+08'::timestamptz, 'manual'),
    ('INS-GLAR-100-PEN', 18, 'Cold Room Auditor', '2026-05-18 17:05+08'::timestamptz, 'manual'),
    ('THERM-DIGI', 22, 'Cycle Counter B', '2026-05-19 10:15+08'::timestamptz, 'manual')
) as seed(sku, physical_count, counted_by, created_at, import_source)
join public.products p on lower(p.sku) = lower(seed.sku)
where not exists (
  select 1
  from public.physical_counts pc
  where lower(pc.sku) = lower(seed.sku)
    and pc.created_at = seed.created_at
);

commit;
