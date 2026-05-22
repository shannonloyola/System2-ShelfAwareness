-- Seed pack: 500-row Fulfillment dataset
-- Project: dkqvbyewfyzfmisyisgs
-- Run in Supabase SQL Editor for the Fulfillment project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.bins (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.delivery_schedules (
  id text primary key,
  delivery_datetime timestamptz not null,
  supplier_name text not null,
  expected_items_count integer not null,
  warehouse_location text not null,
  contact_person_name text,
  contact_phone text,
  notes text,
  status text not null default 'scheduled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.delivery_schedules
  add column if not exists contact_person_name text;

alter table public.delivery_schedules
  add column if not exists contact_phone text;

alter table public.delivery_schedules
  add column if not exists notes text;

alter table public.delivery_schedules
  add column if not exists created_at timestamptz default now();

alter table public.delivery_schedules
  add column if not exists updated_at timestamptz default now();

create table if not exists public.grn_headers (
  id uuid primary key default gen_random_uuid(),
  grn_reference text not null unique,
  received_date date not null,
  status text not null default 'draft',
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.grn_lines (
  id uuid primary key default gen_random_uuid(),
  header_id uuid not null references public.grn_headers(id) on delete cascade,
  line_no integer not null,
  product_sku text not null,
  product_name text not null,
  qty_expected integer not null default 0,
  qty_received integer not null default 0,
  discrepancy_reason text
);

create table if not exists public.shipments (
  shipment_id uuid primary key default gen_random_uuid(),
  po_id uuid not null,
  status text default 'initialized',
  freight_type text,
  estimated_days integer,
  created_at timestamptz default now(),
  po_no text,
  supplier_name text,
  expected_items jsonb,
  tracking_number text unique,
  received_at timestamptz,
  received_by text,
  notes text
);

alter table public.shipments
  add column if not exists po_no text;

alter table public.shipments
  add column if not exists supplier_name text;

alter table public.shipments
  add column if not exists expected_items jsonb;

alter table public.shipments
  add column if not exists tracking_number text;

alter table public.shipments
  add column if not exists received_at timestamptz;

alter table public.shipments
  add column if not exists received_by text;

alter table public.shipments
  add column if not exists notes text;

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  sku text not null,
  product_name text not null,
  qty_before numeric not null,
  qty_change numeric not null,
  qty_after numeric not null,
  reason text not null,
  reason_category text not null,
  status text not null default 'pending',
  movement_type text default 'ADJUSTMENT',
  requested_by text not null,
  approved_by text,
  approved_at timestamptz,
  rejection_note text,
  created_at timestamptz not null default now()
);

insert into public.bins (name)
select format('BIN-%s', lpad(gs::text, 3, '0'))
from generate_series(1, 50) as gs
where not exists (
  select 1
  from public.bins b
  where b.name = format('BIN-%s', lpad(gs::text, 3, '0'))
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.products (
  product_id,
  sku,
  product_name,
  category,
  warehouse_location,
  unit_price,
  currency_code,
  created_at
)
select
  ('30000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('FUL-SKU-%s', lpad(gs::text, 4, '0')),
  format(
    '%s Fulfillment Product %s',
    case
      when gs % 7 = 1 then 'Antibiotic'
      when gs % 7 = 2 then 'Analgesic'
      when gs % 7 = 3 then 'Maintenance'
      when gs % 7 = 4 then 'Diabetes'
      when gs % 7 = 5 then 'Consumable'
      when gs % 7 = 6 then 'Device'
      else 'ColdChain'
    end,
    lpad(gs::text, 4, '0')
  ),
  case
    when gs % 7 = 1 then 'Antibiotics'
    when gs % 7 = 2 then 'Analgesics'
    when gs % 7 = 3 then 'Maintenance Medicines'
    when gs % 7 = 4 then 'Diabetes Care'
    when gs % 7 = 5 then 'Consumables'
    when gs % 7 = 6 then 'Devices'
    else 'Cold Chain'
  end,
  format(
    '%s-%s-%s',
    case when gs % 7 = 0 then 'COLD' when gs % 5 = 0 then 'QTN' else 'ZONE-' || chr(65 + ((gs - 1) % 5)) end,
    lpad((((gs - 1) % 10) + 1)::text, 2, '0'),
    lpad((((gs - 1) % 20) + 1)::text, 2, '0')
  ),
  case
    when gs % 7 = 0 then round((980 + gs * 3.90)::numeric, 2)
    when gs % 6 = 0 then round((250 + gs * 1.75)::numeric, 2)
    else round((6 + gs * 0.88)::numeric, 2)
  end,
  'PHP',
  now() - make_interval(days => (gs % 120))
from src
where not exists (
  select 1
  from public.products p
  where p.sku = format('FUL-SKU-%s', lpad(src.gs::text, 4, '0'))
);

with product_seed as (
  select
    gs,
    ('30000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid as product_uuid,
    format('FUL-SKU-%s', lpad(gs::text, 4, '0')) as sku,
    format('BIN-%s', lpad((((gs - 1) % 50) + 1)::text, 3, '0')) as bin_name,
    case
      when gs % 15 = 0 then 0
      when gs % 7 = 0 then 45 + (gs % 120)
      else 200 + (gs % 1500)
    end::numeric as qty_on_hand
  from generate_series(1, 500) as gs
)
insert into public.inventory_on_hand (
  product_id,
  qty_on_hand,
  bin_id,
  updated_at,
  sku
)
select
  ps.product_uuid,
  ps.qty_on_hand,
  b.id,
  now() - make_interval(hours => (ps.gs % 240)),
  ps.sku
from product_seed ps
join public.bins b
  on b.name = ps.bin_name
on conflict (product_id, bin_id) do update
set
  qty_on_hand = excluded.qty_on_hand,
  updated_at = excluded.updated_at,
  sku = excluded.sku;

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.retail_orders (
  order_uuid,
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
select
  ('40000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('RO-FF-%s', lpad(gs::text, 4, '0')),
  format('Retailer %s', ((gs - 1) % 60) + 1),
  case
    when gs % 10 = 0 then 'fulfilled'
    when gs % 9 = 0 then 'dispatched'
    when gs % 8 = 0 then 'payment_pending'
    when gs % 7 = 0 then 'approved'
    when gs % 13 = 0 then 'cancelled'
    else 'placed'
  end,
  round((2500 + gs * 145.80)::numeric, 2),
  case when gs % 3 = 0 then '30D' when gs % 3 = 1 then 'COD' else '15D' end,
  current_date + ((gs % 30) - 15),
  format('Retail order %s for dashboard fill rate and backorder aging.', lpad(gs::text, 4, '0')),
  case when gs % 12 = 0 then 'Urgent' when gs % 5 = 0 then 'High' else 'Normal' end,
  format('BR-%02s', ((gs - 1) % 25) + 1),
  case when gs % 12 = 0 then 1 when gs % 5 = 0 then 2 else 3 end,
  now() - make_interval(days => (gs % 90), hours => (gs % 23))
from src
where not exists (
  select 1
  from public.retail_orders ro
  where ro.order_no = format('RO-FF-%s', lpad(src.gs::text, 4, '0'))
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.retail_order_lines (
  line_uuid,
  order_uuid,
  sku,
  qty,
  unit_price,
  qty_fulfilled,
  qty_backordered
)
select
  ('50000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('40000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  10 + (gs % 90),
  case
    when gs % 7 = 0 then round((980 + gs * 3.90)::numeric, 2)
    when gs % 6 = 0 then round((250 + gs * 1.75)::numeric, 2)
    else round((6 + gs * 0.88)::numeric, 2)
  end,
  case when gs % 10 = 0 then 10 + (gs % 90) when gs % 4 = 0 then 5 + (gs % 40) else 0 end,
  case when gs % 6 = 0 then 3 + (gs % 12) when gs % 14 = 0 then 0 else 0 end
from src
where not exists (
  select 1
  from public.retail_order_lines rol
  where rol.line_uuid = ('50000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.backorders (
  id,
  sku,
  qty_needed,
  status,
  created_at,
  order_uuid,
  line_uuid,
  order_no,
  retailer_name,
  qty_backordered,
  resolved_at,
  last_alerted_at
)
select
  ('60000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  2 + (gs % 16),
  case when gs % 9 = 0 then 'fulfilled' else 'pending' end,
  now() - make_interval(days => case when gs % 4 = 0 then 35 + (gs % 25) when gs % 3 = 0 then 15 + (gs % 12) when gs % 2 = 0 then 8 + (gs % 6) else gs % 7 end),
  ('40000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('50000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('RO-FF-%s', lpad(gs::text, 4, '0')),
  format('Retailer %s', ((gs - 1) % 60) + 1),
  2 + (gs % 16),
  case when gs % 9 = 0 then now() - make_interval(days => (gs % 5)) else null end,
  now() - make_interval(days => (gs % 10))
from src
where not exists (
  select 1
  from public.backorders bo
  where bo.id = ('60000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.backorder_alerts (
  id,
  sku,
  grn_reference,
  pending_backorder_count,
  message,
  created_at
)
select
  ('70000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  format('GRN-FF-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  1 + (gs % 18),
  case
    when gs % 11 = 0 then 'Critical backorder exposure beyond 30 days.'
    when gs % 7 = 0 then 'Backorder aging is now in warning range.'
    else 'Backorder watchlist item generated by seeded exceptions.'
  end,
  now() - make_interval(hours => (gs % 240))
from src
where not exists (
  select 1
  from public.backorder_alerts ba
  where ba.id = ('70000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with days as (
  select gs
  from generate_series(0, 499) as gs
)
insert into public.inventory_valuation_snapshots (
  snapshot_date,
  total_inventory_value_php,
  category_values,
  source,
  notes,
  generated_at
)
select
  (current_date - gs),
  round(
    (
      5200000
      + (gs * 9150)
      + (sin(gs / 11.0) * 180000)
      - case when gs % 37 = 0 then 240000 else 0 end
    )::numeric,
    2
  ),
  jsonb_build_array(
    jsonb_build_object('category', 'Antibiotics', 'total_value_php', round((650000 + gs * 350)::numeric, 2)),
    jsonb_build_object('category', 'Analgesics', 'total_value_php', round((480000 + gs * 240)::numeric, 2)),
    jsonb_build_object('category', 'Maintenance Medicines', 'total_value_php', round((710000 + gs * 290)::numeric, 2)),
    jsonb_build_object('category', 'Diabetes Care', 'total_value_php', round((820000 + gs * 310)::numeric, 2)),
    jsonb_build_object('category', 'Consumables', 'total_value_php', round((960000 + gs * 420)::numeric, 2)),
    jsonb_build_object('category', 'Devices', 'total_value_php', round((570000 + gs * 265)::numeric, 2)),
    jsonb_build_object('category', 'Cold Chain', 'total_value_php', round((1010000 + gs * 510)::numeric, 2))
  ),
  'seeded-history',
  case when gs % 37 = 0 then 'Intentional valuation dip for anomaly visibility.' else 'Historical point for dashboard trend.' end,
  now() - make_interval(days => gs)
from days
on conflict (snapshot_date) do update
set
  total_inventory_value_php = excluded.total_inventory_value_php,
  category_values = excluded.category_values,
  source = excluded.source,
  notes = excluded.notes,
  generated_at = excluded.generated_at;

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.grn_headers (
  id,
  grn_reference,
  received_date,
  status,
  notes,
  created_by,
  created_at
)
select
  ('80000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('GRN-FF-%s', lpad(gs::text, 4, '0')),
  current_date - (gs % 120),
  case when gs % 10 = 0 then 'pending_review' when gs % 4 = 0 then 'draft' else 'posted' end,
  format('GRN %s seeded for receiving, discrepancy, and warehouse history.', lpad(gs::text, 4, '0')),
  'warehouse-seeder',
  now() - make_interval(days => (gs % 120), hours => (gs % 10))
from src
where not exists (
  select 1
  from public.grn_headers gh
  where gh.grn_reference = format('GRN-DEMO-%s', lpad(src.gs::text, 4, '0'))
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.grn_lines (
  id,
  header_id,
  line_no,
  product_sku,
  product_name,
  qty_expected,
  qty_received,
  discrepancy_reason
)
select
  ('81000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('80000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  1,
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  format('Fulfillment Product %s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  40 + (gs % 180),
  case when gs % 8 = 0 then 35 + (gs % 140) else 40 + (gs % 180) end,
  case when gs % 8 = 0 then 'Quantity variance under review' else null end
from src
where not exists (
  select 1
  from public.grn_lines gl
  where gl.id = ('81000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.delivery_schedules (
  id,
  delivery_datetime,
  supplier_name,
  expected_items_count,
  warehouse_location,
  contact_person_name,
  contact_phone,
  notes,
  status,
  created_at,
  updated_at
)
select
  format('DS-FF-%s', lpad(gs::text, 4, '0')),
  now() + make_interval(days => ((gs % 40) - 10), hours => (gs % 8)),
  format('Supplier %s', ((gs - 1) % 50) + 1),
  1 + (gs % 8),
  format('Receiving Bay %s', ((gs - 1) % 6) + 1),
  format('Receiver %s', ((gs - 1) % 30) + 1),
  format('+63 915 %s %s', lpad(((gs * 17) % 10000)::text, 4, '0'), lpad(((gs * 23) % 10000)::text, 4, '0')),
  format('Receiving schedule %s for warehouse dashboard.', lpad(gs::text, 4, '0')),
  case
    when gs % 9 = 0 then 'arrived'
    when gs % 7 = 0 then 'in_transit'
    when gs % 5 = 0 then 'confirmed'
    when gs % 13 = 0 then 'cancelled'
    else 'scheduled'
  end,
  now() - make_interval(days => (gs % 40)),
  now() - make_interval(days => (gs % 10))
from src
where not exists (
  select 1
  from public.delivery_schedules ds
  where ds.id = format('DS-FF-%s', lpad(src.gs::text, 4, '0'))
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.shipments (
  shipment_id,
  po_id,
  status,
  freight_type,
  estimated_days,
  created_at,
  po_no,
  supplier_name,
  expected_items,
  tracking_number,
  received_at,
  received_by,
  notes
)
select
  ('90000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('91000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  case
    when gs % 10 = 0 then 'received'
    when gs % 9 = 0 then 'quality_check'
    when gs % 7 = 0 then 'arrived_port'
    when gs % 5 = 0 then 'in_transit'
    else 'initialized'
  end,
  case when gs % 2 = 0 then 'Air' else 'Sea' end,
  2 + (gs % 18),
  now() - make_interval(days => (gs % 60)),
  format('PO-FF-%s', lpad(gs::text, 4, '0')),
  format('Supplier %s', ((gs - 1) % 50) + 1),
  jsonb_build_array(jsonb_build_object('sku', format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')), 'qty', 20 + (gs % 90))),
  format('TRK-FF-%s', lpad(gs::text, 4, '0')),
  case when gs % 10 = 0 then now() - make_interval(days => (gs % 5)) else null end,
  case when gs % 10 = 0 then 'warehouse-seeder' else null end,
  format('Shipment %s for receiving and PO detail tabs.', lpad(gs::text, 4, '0'))
from src
where not exists (
  select 1
  from public.shipments s
  where s.tracking_number = format('TRK-FF-%s', lpad(src.gs::text, 4, '0'))
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.stock_adjustments (
  id,
  product_id,
  sku,
  product_name,
  qty_before,
  qty_change,
  qty_after,
  reason,
  reason_category,
  status,
  movement_type,
  requested_by,
  approved_by,
  approved_at,
  rejection_note,
  created_at
)
select
  ('92000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('30000000-0000-0000-0000-' || lpad((((gs - 1) % 500) + 1)::text, 12, '0'))::uuid::text,
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  format('Fulfillment Product %s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  100 + (gs % 900),
  case when gs % 2 = 0 then -1 * (1 + (gs % 25)) else 1 + (gs % 18) end,
  (100 + (gs % 900)) + case when gs % 2 = 0 then -1 * (1 + (gs % 25)) else 1 + (gs % 18) end,
  format('Stock adjustment %s created for approvals, audit, and movement history.', lpad(gs::text, 4, '0')),
  case
    when gs % 5 = 0 then 'Damaged Goods'
    when gs % 4 = 0 then 'Count Correction'
    when gs % 3 = 0 then 'Theft/Loss'
    when gs % 7 = 0 then 'Expiry Write-off'
    else 'System Error'
  end,
  case when gs % 9 = 0 then 'approved' when gs % 11 = 0 then 'rejected' else 'pending' end,
  'ADJUSTMENT',
  format('requester-%s', ((gs - 1) % 20) + 1),
  case when gs % 9 = 0 or gs % 11 = 0 then format('manager-%s', ((gs - 1) % 8) + 1) else null end,
  case when gs % 9 = 0 or gs % 11 = 0 then now() - make_interval(days => (gs % 15)) else null end,
  case when gs % 11 = 0 then 'Rejected after manager review' else null end,
  now() - make_interval(days => (gs % 50), hours => (gs % 12))
from src
where not exists (
  select 1
  from public.stock_adjustments sa
  where sa.id = ('92000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

commit;
