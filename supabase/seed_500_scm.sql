-- Seed pack: 500-row SCM / Supply Chain dataset
-- Project: wbktqkjdsqrvqxxtitsg
-- Run in Supabase SQL Editor for the SCM / Supply Chain project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.supplier_scorecard_cache (
  supplier_key text primary key,
  supplier_name text not null,
  total_pos integer not null default 0,
  approved_pos integer not null default 0,
  po_approval_rate numeric not null default 0,
  total_receipts integer not null default 0,
  on_time_receipts integer not null default 0,
  on_time_delivery_pct numeric not null default 0,
  total_discrepancies integer not null default 0,
  approved_discrepancies integer not null default 0,
  rejected_discrepancies integer not null default 0,
  avg_discrepancy_units numeric not null default 0,
  defect_rate numeric not null default 0,
  reliability_score numeric not null default 0,
  risk_level text not null default 'medium',
  risk_summary text,
  source_month date,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.product_categories (name, parent_id)
select seed.name, null::uuid
from (
  values ('Pharma'), ('Medical Supplies'), ('Cold Chain')
) as seed(name)
where not exists (
  select 1
  from public.product_categories pc
  where lower(pc.name) = lower(seed.name)
    and pc.parent_id is null
);

with parents as (
  select id, lower(name) as key_name
  from public.product_categories
  where parent_id is null
),
seed_children as (
  select 'Antibiotics'::text as name, id as parent_id from parents where key_name = 'pharma'
  union all
  select 'Analgesics', id from parents where key_name = 'pharma'
  union all
  select 'Maintenance Medicines', id from parents where key_name = 'pharma'
  union all
  select 'Diabetes Care', id from parents where key_name = 'pharma'
  union all
  select 'Consumables', id from parents where key_name = 'medical supplies'
  union all
  select 'Devices', id from parents where key_name = 'medical supplies'
  union all
  select 'Refrigerated', id from parents where key_name = 'cold chain'
)
insert into public.product_categories (name, parent_id)
select sc.name, sc.parent_id
from seed_children sc
where not exists (
  select 1
  from public.product_categories pc
  where lower(pc.name) = lower(sc.name)
    and pc.parent_id is not distinct from sc.parent_id
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
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
select
  format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((gs - 1) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((gs - 1) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((gs - 1) / 100) % 5) + 1]
  ),
  format('Contact %s', lpad(gs::text, 4, '0')),
  format('supplier%1$s@sample.local', lpad(gs::text, 4, '0')),
  format('+63 917 %s %s', lpad(((gs * 13) % 10000)::text, 4, '0'), lpad(((gs * 29) % 10000)::text, 4, '0')),
  format('Warehouse District %s, Metro Manila', ((gs - 1) % 25) + 1),
  case when gs % 9 = 0 then 'USD' when gs % 14 = 0 then 'JPY' else 'PHP' end,
  3 + (gs % 21),
  case when gs % 11 = 0 then 'Suspended' else 'Active' end
from src
where not exists (
  select 1
  from public.suppliers s
  where s.supplier_name = format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((src.gs - 1) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((src.gs - 1) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((src.gs - 1) / 100) % 5) + 1]
  )
);

with category_map as (
  select lower(name) as category_name, id
  from public.product_categories
),
src as (
  select gs
  from generate_series(1, 500) as gs
),
seed_products as (
  select
    gs,
    format('SCM-SKU-%s', lpad(gs::text, 4, '0')) as sku,
    format(
      '%s Product %s',
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
    ) as product_name,
    case when gs % 10 = 0 then 'box' else 'pcs' end as unit,
    '48' || lpad((10000000000 + gs)::text, 11, '0') as barcode,
    case
      when gs % 7 = 1 then 'Antibiotics'
      when gs % 7 = 2 then 'Analgesics'
      when gs % 7 = 3 then 'Maintenance Medicines'
      when gs % 7 = 4 then 'Diabetes Care'
      when gs % 7 = 5 then 'Consumables'
      when gs % 7 = 6 then 'Devices'
      else 'Refrigerated'
    end as category_name,
    format(
      '%s %s %s',
      (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((((gs - 1) % 500)) % 10) + 1],
      (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((((gs - 1) % 500)) / 10) % 10) + 1],
      (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((((gs - 1) % 500)) / 100) % 5) + 1]
    ) as supplier_name,
    format(
      '%s-%s-%s',
      case when gs % 7 = 0 then 'COLD' when gs % 5 = 0 then 'QTN' else 'ZONE-' || chr(65 + ((gs - 1) % 5)) end,
      lpad((((gs - 1) % 12) + 1)::text, 2, '0'),
      lpad((((gs - 1) % 24) + 1)::text, 2, '0')
    ) as warehouse_location,
    case
      when gs % 7 = 0 then round((900 + gs * 4.35)::numeric, 2)
      when gs % 6 = 0 then round((250 + gs * 2.15)::numeric, 2)
      else round((8 + gs * 0.95)::numeric, 2)
    end as unit_price,
    case
      when gs % 17 = 0 then 0
      when gs % 9 = 0 then 80 + (gs % 160)
      else 300 + (gs % 1700)
    end as inventory_on_hand,
    5 + (gs % 60) as low_stock_threshold,
    case when gs % 8 = 0 then 40 + (gs % 180) else 5 + (gs % 40) end as reserved_stock,
    case when gs % 23 = 0 then 10 + (gs % 25) else 0 end as quarantine_stock
  from src
)
insert into public.products (
  sku,
  product_name,
  unit,
  barcode,
  category,
  supplier,
  warehouse_location,
  unit_price,
  inventory_on_hand,
  category_id,
  currency_code,
  reserved_stock,
  quarantine_stock,
  low_stock_threshold
)
select
  sp.sku,
  sp.product_name,
  sp.unit,
  sp.barcode,
  sp.category_name,
  sp.supplier_name,
  sp.warehouse_location,
  sp.unit_price,
  sp.inventory_on_hand,
  cm.id,
  'PHP',
  sp.reserved_stock,
  sp.quarantine_stock,
  sp.low_stock_threshold
from seed_products sp
left join category_map cm
  on lower(cm.category_name) = lower(sp.category_name)
where not exists (
  select 1
  from public.products p
  where p.sku = sp.sku
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.purchase_orders (
  po_no,
  supplier_name,
  status,
  created_at,
  reserved_at,
  expires_at,
  paid_at,
  expected_delivery_date,
  preferred_communication,
  total_value,
  approval_status,
  approved_at,
  import_source,
  notes,
  transit_status,
  freight_mode,
  freight_cost,
  freight_type,
  customs_entry_date,
  customs_release_date,
  duties_paid,
  landed_costs_posted_at,
  is_late,
  rejection_reason,
  rejected_at,
  carrier_name,
  carrier_tracking_ref,
  transit_updated_at,
  transit_updated_by,
  transit_notes
)
select
  format('PO-SCM-%s', lpad(gs::text, 4, '0')),
  format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((((gs - 1) % 500)) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((((gs - 1) % 500)) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((((gs - 1) % 500)) / 100) % 5) + 1]
  ),
  case
    when gs % 10 = 0 then 'Received'
    when gs % 9 = 0 then 'Approved'
    when gs % 8 = 0 then 'Confirmed'
    when gs % 7 = 0 then 'Quality Check'
    when gs % 6 = 0 then 'Pending Supplier Confirmation'
    when gs % 5 = 0 then 'Approved'
    else 'In-Transit'
  end,
  now() - make_interval(days => gs % 180, hours => gs % 23),
  now() - make_interval(days => gs % 180, hours => gs % 23),
  now() + make_interval(hours => 12 + (gs % 48)),
  case when gs % 10 = 0 then now() - make_interval(days => (gs % 120)) else null end,
  current_date + ((gs % 45) - 15),
  case when gs % 3 = 0 then 'email' when gs % 3 = 1 then 'whatsapp' else 'viber' end,
  round((12000 + gs * 175.25)::numeric, 2),
  case when gs % 13 = 0 then 'Rejected' when gs % 4 = 0 then 'Pending' else 'Approved' end,
  case when gs % 13 = 0 or gs % 4 = 0 then null else now() - make_interval(days => (gs % 90)) end,
  case when gs % 12 = 0 then 'csv_import' else 'manual' end,
  format('PO %s covering inbound replenishment, transit, customs, and approval scenarios.', lpad(gs::text, 4, '0')),
  case
    when gs % 11 = 0 then 'Stuck at Customs'
    when gs % 10 = 0 then 'Received'
    when gs % 9 = 0 then 'customs_clearance'
    when gs % 8 = 0 then 'arrived_port'
    when gs % 7 = 0 then 'in_transit'
    when gs % 6 = 0 then 'confirmed'
    else 'pending'
  end,
  case when gs % 2 = 0 then 'Air' else 'Sea' end,
  round((2500 + (gs % 40) * 220.40)::numeric, 2),
  case when gs % 2 = 0 then 'Express' else 'Consolidated' end,
  case when gs % 11 = 0 then now() - make_interval(days => 6 + (gs % 8)) else null end,
  case when gs % 10 = 0 then now() - make_interval(days => 1 + (gs % 4)) else null end,
  case when gs % 11 = 0 then round((8000 + gs * 41.50)::numeric, 2) else 0 end,
  case when gs % 10 = 0 then now() - make_interval(days => (gs % 10)) else null end,
  (gs % 11 = 0),
  case when gs % 13 = 0 then 'Budget hold after review' else null end,
  case when gs % 13 = 0 then now() - make_interval(days => (gs % 20)) else null end,
  format('Carrier %s', ((gs - 1) % 12) + 1),
  format('TRK-SCM-%s', lpad(gs::text, 4, '0')),
  now() - make_interval(days => (gs % 25)),
  'system-seeder',
  format('Transit checkpoint update for PO-SCM-%s', lpad(gs::text, 4, '0'))
from src
where not exists (
  select 1
  from public.purchase_orders po
  where po.po_no = format('PO-SCM-%s', lpad(src.gs::text, 4, '0'))
);

with seed_items as (
  select
    gs,
    format('PO-SCM-%s', lpad(gs::text, 4, '0')) as po_no,
    format(
      '%s Product %s',
      case
        when gs % 7 = 1 then 'Antibiotic'
        when gs % 7 = 2 then 'Analgesic'
        when gs % 7 = 3 then 'Maintenance'
        when gs % 7 = 4 then 'Diabetes'
        when gs % 7 = 5 then 'Consumable'
        when gs % 7 = 6 then 'Device'
        else 'ColdChain'
      end,
      lpad((((gs - 1) % 500) + 1)::text, 4, '0')
    ) as item_name,
    20 + (gs % 180) as quantity,
    round((15 + gs * 1.85)::numeric, 2) as unit_price
  from generate_series(1, 500) as gs
)
insert into public.purchase_order_items (
  po_id,
  item_name,
  quantity,
  unit_price
)
select
  po.po_id,
  si.item_name,
  si.quantity,
  si.unit_price
from seed_items si
join public.purchase_orders po
  on po.po_no = si.po_no
where not exists (
  select 1
  from public.purchase_order_items poi
  where poi.po_id = po.po_id
    and poi.item_name = si.item_name
);

with item_totals as (
  select
    poi.po_id,
    sum(poi.quantity * coalesce(poi.unit_price, 0)) as total_value
  from public.purchase_order_items poi
  join public.purchase_orders po
    on po.po_id = poi.po_id
  where po.po_no like 'PO-SCM-%'
  group by poi.po_id
)
update public.purchase_orders po
set total_value = it.total_value
from item_totals it
where po.po_id = it.po_id;

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.freight_quotes (
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
)
select
  ('10000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  po.po_id,
  po.po_no,
  format('Freight Provider %s', ((gs - 1) % 15) + 1),
  case when gs % 2 = 0 then 'Air' else 'Sea' end,
  round((3500 + (gs % 90) * 130.75)::numeric, 2),
  2 + (gs % 21),
  (gs % 5 = 0),
  now() - make_interval(days => (gs % 60)),
  now() - make_interval(days => (gs % 30))
from src
join public.purchase_orders po
  on po.po_no = format('PO-SCM-%s', lpad(src.gs::text, 4, '0'))
where not exists (
  select 1
  from public.freight_quotes fq
  where fq.id = ('10000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with months as (
  select
    gs,
    (date_trunc('month', current_date)::date - make_interval(months => gs))::date as month_start
  from generate_series(0, 499) as gs
)
insert into public.monthly_budgets (
  month,
  year,
  allocated_amount,
  spent_amount
)
select
  extract(month from month_start)::int,
  extract(year from month_start)::int,
  round((1500000 + gs * 4200.00)::numeric, 2),
  round(
    (
      1500000 + gs * 4200.00
    ) * case
      when gs = 0 then 0.88
      when gs % 7 = 0 then 0.93
      when gs % 5 = 0 then 0.81
      else 0.62 + ((gs % 20) * 0.01)
    end,
    2
  )
from months
where not exists (
  select 1
  from public.monthly_budgets mb
  where mb.month = extract(month from months.month_start)::int
    and mb.year = extract(year from months.month_start)::int
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
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
select
  lower(
    replace(
      format(
        '%s-%s-%s',
        (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((gs - 1) % 10) + 1],
        (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((gs - 1) / 10) % 10) + 1],
        (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((gs - 1) / 100) % 5) + 1]
      ),
      ' ',
      '-'
    )
  ),
  format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((gs - 1) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((gs - 1) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((gs - 1) / 100) % 5) + 1]
  ),
  8 + (gs % 60),
  5 + (gs % 40),
  round((70 + (gs % 31))::numeric, 2),
  4 + (gs % 35),
  2 + (gs % 30),
  round((68 + (gs % 33))::numeric, 2),
  gs % 14,
  gs % 8,
  gs % 5,
  round((1 + (gs % 12) * 0.75)::numeric, 2),
  round((1 + (gs % 18) * 0.85)::numeric, 2),
  round(
    case
      when gs % 11 = 0 then 54 + (gs % 12)
      when gs % 7 = 0 then 71 + (gs % 10)
      else 86 + (gs % 12)
    end::numeric,
    2
  ),
  case
    when gs % 11 = 0 then 'high'
    when gs % 7 = 0 then 'medium'
    else 'low'
  end,
  case
    when gs % 11 = 0 then 'Chronic customs, discrepancy, or on-time risk'
    when gs % 7 = 0 then 'Needs monitoring for reliability drift'
    else 'Healthy supplier profile'
  end,
  date_trunc('month', current_date)::date,
  now() - make_interval(days => (gs % 20)),
  now() - make_interval(days => (gs % 10))
from src
on conflict (supplier_key) do update
set
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

commit;
