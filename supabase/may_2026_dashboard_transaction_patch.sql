-- May 2026 dashboard transaction patch
-- Safe intent: feed the reporting dashboard without altering product master records.
-- Critical constraint honored: no INSERT/UPDATE/DELETE against public.products.

begin;

-- 0) Diagnosis: run this result set before/after the patch to confirm gaps.
select 'monthly_budgets May 2026' as check_name, count(*)::text as current_rows
from public.monthly_budgets
where month = 5 and year = 2026
union all
select 'purchase_orders May 2026', count(*)::text
from public.purchase_orders
where created_at >= '2026-05-01'::date and created_at < '2026-06-01'::date
union all
select 'inventory_on_hand rows joined to products', count(*)::text
from public.inventory_on_hand ioh
join public.products p
  on ioh.product_id::text in (p.product_uuid::text, p.product_id::text)
union all
select 'open backorders', count(*)::text
from public.backorders
where status = 'pending'
union all
select 'supplier scorecard cache May 2026', count(*)::text
from public.supplier_scorecard_cache
where source_month = '2026-05-01'::date;

-- 1) Current month procurement budget.
update public.monthly_budgets
set
  allocated_amount = 1850000,
  spent_amount = 642500
where month = 5
  and year = 2026;

insert into public.monthly_budgets (month, year, allocated_amount, spent_amount)
select 5, 2026, 1850000, 642500
where not exists (
  select 1 from public.monthly_budgets where month = 5 and year = 2026
);

-- 2) Suppliers needed by scorecards and purchase orders.
insert into public.suppliers (
  supplier_name,
  contact_person,
  email,
  phone,
  address,
  currency_code,
  lead_time_days,
  status
)
select *
from (
  values
    ('HealthMed Supply', 'Maria Santos', 'orders@healthmed.ph', '+63 917 100 2040', 'Mandaluyong, Metro Manila', 'PHP', 7, 'Active'),
    ('MediCore Pharma', 'Jose Lim', 'procurement@medicore.ph', '+63 917 300 5080', 'Cebu City, Philippines', 'PHP', 10, 'Active'),
    ('ColdChain Rx Logistics', 'Aileen Cruz', 'rx@coldchain.ph', '+63 917 420 6610', 'Paranaque, Metro Manila', 'PHP', 5, 'Active'),
    ('NorthStar Generics', 'Paolo Reyes', 'sales@northstargenerics.ph', '+63 917 880 1940', 'Quezon City, Philippines', 'PHP', 14, 'Active')
) as seed(supplier_name, contact_person, email, phone, address, currency_code, lead_time_days, status)
where not exists (
  select 1
  from public.suppliers s
  where lower(s.supplier_name) = lower(seed.supplier_name)
);

-- 3) Purchase orders for May 2026. These create procurement activity, commitments,
-- supplier reliability inputs, and PO stage/funnel data.
insert into public.purchase_orders (
  po_no,
  supplier_name,
  status,
  created_at,
  reserved_at,
  paid_at,
  expected_delivery_date,
  total_value,
  approval_status,
  approved_at,
  import_source,
  notes,
  transit_status,
  freight_mode,
  freight_cost,
  customs_entry_date,
  customs_release_date,
  duties_paid,
  is_late
)
select *
from (
  values
    ('PO-MAY26-001', 'HealthMed Supply', 'Received', '2026-05-02 09:10+08'::timestamptz, '2026-05-02 09:10+08'::timestamptz, '2026-05-09 14:20+08'::timestamptz, '2026-05-09'::date, 284500, 'Approved', '2026-05-02 13:00+08'::timestamp, 'manual', 'Amoxicillin and paracetamol replenishment', 'Received', 'Air', 8200, null::timestamptz, null::timestamptz, 0, false),
    ('PO-MAY26-002', 'HealthMed Supply', 'Approved', '2026-05-07 10:30+08'::timestamptz, '2026-05-07 10:30+08'::timestamptz, null::timestamptz, '2026-05-22'::date, 176800, 'Approved', '2026-05-07 15:10+08'::timestamp, 'manual', 'Antihypertensive safety stock', 'In Transit', 'Air', 6400, null::timestamptz, null::timestamptz, 0, false),
    ('PO-MAY26-003', 'MediCore Pharma', 'Pending Supplier Confirmation', '2026-05-11 11:45+08'::timestamptz, '2026-05-11 11:45+08'::timestamptz, null::timestamptz, '2026-05-28'::date, 412300, 'Pending', null::timestamp, 'manual', 'Diabetes and maintenance medication coverage', null, 'Sea', 11900, null::timestamptz, null::timestamptz, 0, false),
    ('PO-MAY26-004', 'ColdChain Rx Logistics', 'Quality Check', '2026-05-13 08:15+08'::timestamptz, '2026-05-13 08:15+08'::timestamptz, null::timestamptz, '2026-05-18'::date, 298600, 'Approved', '2026-05-13 10:05+08'::timestamp, 'manual', 'Insulin cold-chain replenishment', 'Quality Check', 'Air', 15400, null::timestamptz, null::timestamptz, 0, false),
    ('PO-MAY26-005', 'NorthStar Generics', 'Approved', '2026-05-15 16:40+08'::timestamptz, '2026-05-15 16:40+08'::timestamptz, null::timestamptz, '2026-06-02'::date, 219750, 'Approved', '2026-05-16 09:00+08'::timestamp, 'manual', 'Antibiotic generic alternatives', 'Stuck at Customs', 'Sea', 9900, '2026-05-12 09:00+08'::timestamptz, null::timestamptz, 18500, true)
) as seed(po_no, supplier_name, status, created_at, reserved_at, paid_at, expected_delivery_date, total_value, approval_status, approved_at, import_source, notes, transit_status, freight_mode, freight_cost, customs_entry_date, customs_release_date, duties_paid, is_late)
where not exists (
  select 1 from public.purchase_orders po where po.po_no = seed.po_no
);

-- 4) PO line items. Uses existing product names when SKU candidates exist;
-- otherwise the PO still remains valid with realistic item names.
insert into public.purchase_order_items (po_id, item_name, quantity, unit_price)
select po.po_id, seed.item_name, seed.quantity, seed.unit_price
from (
  values
    ('PO-MAY26-001', 'Amoxicillin 500mg Capsule', 1200, 18.75),
    ('PO-MAY26-001', 'Paracetamol 500mg Tablet', 3000, 2.85),
    ('PO-MAY26-002', 'Losartan 50mg Tablet', 1600, 7.50),
    ('PO-MAY26-003', 'Metformin 500mg Tablet', 2200, 3.95),
    ('PO-MAY26-004', 'Insulin Glargine 100IU/mL Pen', 180, 1380.00),
    ('PO-MAY26-005', 'Azithromycin 500mg Tablet', 900, 42.50)
) as seed(po_no, item_name, quantity, unit_price)
join public.purchase_orders po on po.po_no = seed.po_no
where not exists (
  select 1
  from public.purchase_order_items poi
  where poi.po_id = po.po_id
    and lower(poi.item_name) = lower(seed.item_name)
);

-- 5) Inventory rows joined to existing products only. No product master changes.
insert into public.bins (name)
select 'MAIN-PHARMACY-01'
where not exists (
  select 1 from public.bins where name = 'MAIN-PHARMACY-01'
);

with sku_targets as (
  select *
  from (
    values
      ('AMOX-500-CAP'::text, 42::numeric),
      ('PARA-500-TAB', 980),
      ('LOSA-50-TAB', 75),
      ('METF-500-TAB', 120),
      ('INS-GLAR-100-PEN', 8),
      ('AZI-500-TAB', 16)
  ) as seed(sku, qty_on_hand)
),
selected_products as (
  select p.product_uuid as product_key, p.sku, st.qty_on_hand
  from sku_targets st
  join public.products p on lower(p.sku::text) = lower(st.sku)
  union all
  select p.product_uuid as product_key, p.sku, fallback.qty_on_hand
  from (
    select p.*, row_number() over (order by p.product_id) as rn
    from public.products p
  ) p
  join (
    values (1, 42::numeric), (2, 980), (3, 75), (4, 120), (5, 8), (6, 16)
  ) as fallback(rn, qty_on_hand) on fallback.rn = p.rn
  where not exists (
    select 1
    from sku_targets st
    join public.products px on lower(px.sku::text) = lower(st.sku)
  )
),
target_bin as (
  select id from public.bins where name = 'MAIN-PHARMACY-01' limit 1
)
insert into public.inventory_on_hand (product_id, bin_id, qty_on_hand, updated_at)
select sp.product_key, tb.id, sp.qty_on_hand, '2026-05-18 18:00+08'::timestamptz
from selected_products sp
cross join target_bin tb
on conflict (product_id, bin_id)
do update set
  qty_on_hand = excluded.qty_on_hand,
  updated_at = excluded.updated_at;

-- 6) Backorders and retail order lines so Operations backorder aging has real work.
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
  created_at
)
select *
from (
  values
    ('RO-MAY26-001', 'Mercury Drug - Makati', 'approved', 28650, 'Net 15', '2026-05-23'::date, 'Critical maintenance medication replenishment', 'Urgent', 'MKT', '2026-05-08 12:20+08'::timestamptz),
    ('RO-MAY26-002', 'Southstar Drug - Cebu', 'approved', 51120, 'Net 15', '2026-05-27'::date, 'Cold chain allocation pending', 'High', 'CEB', '2026-05-12 09:35+08'::timestamptz)
) as seed(order_no, retailer_name, status, total_amount, payment_terms, due_date, notes, priority_level, branch_suffix, created_at)
where not exists (
  select 1 from public.retail_orders ro where ro.order_no = seed.order_no
);

with candidate_lines as (
  select ro.order_uuid, p.sku, seed.qty, seed.unit_price, seed.qty_fulfilled, seed.qty_backordered, seed.created_at
  from (
    values
      ('RO-MAY26-001', 'AMOX-500-CAP', 120, 18.75, 78, 42, '2026-05-08 12:25+08'::timestamptz),
      ('RO-MAY26-001', 'LOSA-50-TAB', 90, 7.50, 75, 15, '2026-05-08 12:26+08'::timestamptz),
      ('RO-MAY26-002', 'INS-GLAR-100-PEN', 24, 1380.00, 8, 16, '2026-05-12 09:40+08'::timestamptz)
  ) as seed(order_no, sku, qty, unit_price, qty_fulfilled, qty_backordered, created_at)
  join public.retail_orders ro on ro.order_no = seed.order_no
  join public.products p on lower(p.sku::text) = lower(seed.sku)
)
insert into public.retail_order_lines (
  order_uuid,
  sku,
  qty,
  unit_price,
  qty_fulfilled,
  qty_backordered,
  created_at
)
select order_uuid, sku, qty, unit_price, qty_fulfilled, qty_backordered, created_at
from candidate_lines cl
where not exists (
  select 1
  from public.retail_order_lines rol
  where rol.order_uuid = cl.order_uuid
    and lower(rol.sku) = lower(cl.sku)
);

with candidate_backorders as (
  select ro.order_uuid, ro.order_no, ro.retailer_name, p.sku, seed.qty_needed, seed.qty_backordered, seed.created_at
  from (
    values
      ('RO-MAY26-001', 'AMOX-500-CAP', 42, 42, '2026-05-08 12:30+08'::timestamptz),
      ('RO-MAY26-001', 'LOSA-50-TAB', 15, 15, '2026-05-08 12:31+08'::timestamptz),
      ('RO-MAY26-002', 'INS-GLAR-100-PEN', 16, 16, '2026-05-12 09:45+08'::timestamptz)
  ) as seed(order_no, sku, qty_needed, qty_backordered, created_at)
  join public.retail_orders ro on ro.order_no = seed.order_no
  join public.products p on lower(p.sku::text) = lower(seed.sku)
)
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
select sku, qty_needed, 'pending', created_at, order_uuid, order_no, retailer_name, qty_backordered, now()
from candidate_backorders cb
where not exists (
  select 1
  from public.backorders bo
  where bo.order_uuid = cb.order_uuid
    and lower(bo.sku) = lower(cb.sku)
    and bo.status = 'pending'
);

insert into public.backorder_alerts (sku, grn_reference, pending_backorder_count, message, created_at)
select bo.sku, null, sum(bo.qty_backordered)::integer, 'Pending backorder requires procurement/warehouse action', max(bo.created_at)
from public.backorders bo
where bo.status = 'pending'
group by bo.sku
having not exists (
  select 1
  from public.backorder_alerts ba
  where lower(ba.sku) = lower(bo.sku)
);

-- 7) Quality/discrepancy rows so supplier defect rates are not empty.
insert into public.shipment_discrepancies (
  grn_reference,
  shipment_reference,
  product_sku,
  product_name,
  batch_number,
  system_count,
  physical_count,
  discrepancy_units,
  reason_code,
  status,
  reported_by,
  reported_at,
  created_at,
  severity,
  supplier_name,
  disposition_action,
  disposition
)
select *
from (
  values
    ('GRN-MAY26-001', 'SHP-MAY26-001', 'AMOX-500-CAP', 'Amoxicillin 500mg Capsule', 'AMX0526A', 1200, 1194, 6, 'SHORT_SHIP', 'approved', 'warehouse.qa', '2026-05-09 15:00+08'::timestamptz, '2026-05-09 15:00+08'::timestamptz, 'Minor', 'HealthMed Supply', 'Accept Variance', 'released'),
    ('GRN-MAY26-004', 'SHP-MAY26-004', 'INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 'COLD0526B', 180, 176, 4, 'TEMP_EXCURSION', 'pending', 'warehouse.qa', '2026-05-18 10:30+08'::timestamptz, '2026-05-18 10:30+08'::timestamptz, 'Major', 'ColdChain Rx Logistics', 'Quarantine', null)
) as seed(grn_reference, shipment_reference, product_sku, product_name, batch_number, system_count, physical_count, discrepancy_units, reason_code, status, reported_by, reported_at, created_at, severity, supplier_name, disposition_action, disposition)
where not exists (
  select 1
  from public.shipment_discrepancies sd
  where sd.grn_reference = seed.grn_reference
    and lower(sd.product_sku) = lower(seed.product_sku)
);

-- 8) Optional deterministic scorecard cache for presentation stability.
insert into public.supplier_scorecard_cache (
  supplier_key,
  supplier_name,
  total_pos,
  approved_pos,
  po_approval_rate,
  total_receipts,
  on_time_receipts,
  on_time_delivery_pct,
  total_discrepancies,
  approved_discrepancies,
  rejected_discrepancies,
  avg_discrepancy_units,
  defect_rate,
  reliability_score,
  risk_level,
  risk_summary,
  source_month,
  computed_at,
  updated_at
)
select *
from (
  values
    ('healthmed supply', 'HealthMed Supply', 2, 2, 100.00, 1, 1, 100.00, 1, 1, 0, 6.00, 0.00, 100.00, 'low', 'Reliable May 2026 supplier; monitor minor receiving variance.', '2026-05-01'::date, now(), now()),
    ('medicore pharma', 'MediCore Pharma', 1, 0, 0.00, 0, 0, 0.00, 0, 0, 0, 0.00, 0.00, 30.00, 'high', 'Pending approval and no May receipts yet.', '2026-05-01'::date, now(), now()),
    ('coldchain rx logistics', 'ColdChain Rx Logistics', 1, 1, 100.00, 0, 0, 0.00, 1, 0, 0, 4.00, 100.00, 0.00, 'high', 'Cold-chain quality check requires management action.', '2026-05-01'::date, now(), now()),
    ('northstar generics', 'NorthStar Generics', 1, 1, 100.00, 0, 0, 0.00, 0, 0, 0, 0.00, 0.00, 30.00, 'medium', 'Customs delay is impacting expected replenishment.', '2026-05-01'::date, now(), now())
) as seed(supplier_key, supplier_name, total_pos, approved_pos, po_approval_rate, total_receipts, on_time_receipts, on_time_delivery_pct, total_discrepancies, approved_discrepancies, rejected_discrepancies, avg_discrepancy_units, defect_rate, reliability_score, risk_level, risk_summary, source_month, computed_at, updated_at)
on conflict (supplier_key)
do update set
  supplier_name = excluded.supplier_name,
  total_pos = excluded.total_pos,
  approved_pos = excluded.approved_pos,
  po_approval_rate = excluded.po_approval_rate,
  total_receipts = excluded.total_receipts,
  on_time_receipts = excluded.on_time_receipts,
  on_time_delivery_pct = excluded.on_time_delivery_pct,
  total_discrepancies = excluded.total_discrepancies,
  approved_discrepancies = excluded.approved_discrepancies,
  rejected_discrepancies = excluded.rejected_discrepancies,
  avg_discrepancy_units = excluded.avg_discrepancy_units,
  defect_rate = excluded.defect_rate,
  reliability_score = excluded.reliability_score,
  risk_level = excluded.risk_level,
  risk_summary = excluded.risk_summary,
  source_month = excluded.source_month,
  computed_at = excluded.computed_at,
  updated_at = excluded.updated_at;

-- 9) Align inventory exposure views with transactional stock.
-- This does not mutate public.products; it fixes reporting math so exposure uses inventory_on_hand.
create or replace view public.v_total_inventory_value_php as
select coalesce(sum(coalesce(ioh.qty_on_hand, p.inventory_on_hand, 0) * coalesce(p.unit_price, 0)), 0) as total_inventory_value_php
from public.products p
left join lateral (
  select sum(qty_on_hand) as qty_on_hand
  from public.inventory_on_hand ioh
  where ioh.product_id::text in (p.product_uuid::text, p.product_id::text)
) ioh on true;

create or replace view public.v_inventory_value_by_category_php as
select
  coalesce(p.category, 'Uncategorized') as category_name,
  coalesce(sum(coalesce(ioh.qty_on_hand, p.inventory_on_hand, 0) * coalesce(p.unit_price, 0)), 0) as total_value_php
from public.products p
left join lateral (
  select sum(qty_on_hand) as qty_on_hand
  from public.inventory_on_hand ioh
  where ioh.product_id::text in (p.product_uuid::text, p.product_id::text)
) ioh on true
group by coalesce(p.category, 'Uncategorized');

commit;
