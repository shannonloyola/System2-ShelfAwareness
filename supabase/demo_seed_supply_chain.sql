-- Demo seed: Supply Chain project
-- Run this in Supabase project: wbktqkjdsqrvqxxtitsg
-- Supports: Dashboard, Product Master, Inbound Procurement, PO List

begin;

-- 1) Budget signal for dashboard
insert into public.monthly_budgets (month, year, allocated_amount, spent_amount)
values
  (3, 2026, 1650000, 1184000),
  (4, 2026, 1725000, 1492500),
  (5, 2026, 1900000, 1428300)
on conflict do nothing;

update public.monthly_budgets
set allocated_amount = 1900000,
    spent_amount = 1428300
where month = 5 and year = 2026;

-- 2) Category tree for Product Master
insert into public.product_categories (name, parent_id)
select seed.name, null::uuid
from (
  values
    ('Pharma'),
    ('Medical Supplies'),
    ('Cold Chain')
) as seed(name)
where not exists (
  select 1
  from public.product_categories pc
  where lower(pc.name) = lower(seed.name)
    and pc.parent_id is null
);

with parents as (
  select id, lower(name) as key
  from public.product_categories
  where parent_id is null
),
seed_subcategories as (
  select 'Antibiotics'::text as name, id as parent_id from parents where key = 'pharma'
  union all
  select 'Maintenance Medicines', id from parents where key = 'pharma'
  union all
  select 'Diabetes Care', id from parents where key = 'pharma'
  union all
  select 'Analgesics', id from parents where key = 'pharma'
  union all
  select 'Consumables', id from parents where key = 'medical supplies'
  union all
  select 'Devices', id from parents where key = 'medical supplies'
  union all
  select 'Refrigerated', id from parents where key = 'cold chain'
)
insert into public.product_categories (name, parent_id)
select seed.name, seed.parent_id
from seed_subcategories seed
where not exists (
  select 1
  from public.product_categories pc
  where lower(pc.name) = lower(seed.name)
    and pc.parent_id is not distinct from seed.parent_id
);

-- 3) Suppliers used across procurement + scorecards
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
    ('NorthStar Generics', 'Paolo Reyes', 'sales@northstargenerics.ph', '+63 917 880 1940', 'Quezon City, Philippines', 'PHP', 14, 'Active'),
    ('Summit Biocare', 'Erika Dizon', 'orders@summitbiocare.ph', '+63 917 630 1400', 'Pasig City, Philippines', 'PHP', 9, 'Active'),
    ('Pacific Wellness Labs', 'Ramon Flores', 'hello@pacificwellness.ph', '+63 917 741 9500', 'Davao City, Philippines', 'PHP', 12, 'Active')
) as seed(supplier_name, contact_person, email, phone, address, currency_code, lead_time_days, status)
where not exists (
  select 1
  from public.suppliers s
  where lower(s.supplier_name) = lower(seed.supplier_name)
);

-- 4) Product catalog depth for Product Master + valuation
with category_map as (
  select lower(pc.name) as category_name, pc.id
  from public.product_categories pc
),
seed_products as (
  select *
  from (
    values
      ('AMOX-500-CAP', 'Amoxicillin 500mg Capsule', 'pcs', '4801234500001', 'Antibiotics', 'HealthMed Supply', 'WH-A1', 18.75, 680, 48, 12, 40),
      ('AZI-500-TAB', 'Azithromycin 500mg Tablet', 'pcs', '4801234500002', 'Antibiotics', 'NorthStar Generics', 'WH-A1', 42.50, 210, 25, 5, 30),
      ('PARA-500-TAB', 'Paracetamol 500mg Tablet', 'pcs', '4801234500003', 'Analgesics', 'HealthMed Supply', 'WH-A2', 2.85, 3200, 120, 0, 200),
      ('IBU-200-TAB', 'Ibuprofen 200mg Tablet', 'pcs', '4801234500004', 'Analgesics', 'Pacific Wellness Labs', 'WH-A2', 4.95, 1460, 60, 0, 150),
      ('LOSA-50-TAB', 'Losartan 50mg Tablet', 'pcs', '4801234500005', 'Maintenance Medicines', 'MediCore Pharma', 'WH-B1', 7.50, 940, 70, 0, 90),
      ('AMLO-5-TAB', 'Amlodipine 5mg Tablet', 'pcs', '4801234500006', 'Maintenance Medicines', 'MediCore Pharma', 'WH-B1', 6.20, 880, 65, 0, 90),
      ('METF-500-TAB', 'Metformin 500mg Tablet', 'pcs', '4801234500007', 'Diabetes Care', 'MediCore Pharma', 'WH-B2', 3.95, 1520, 80, 0, 110),
      ('INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 'pcs', '4801234500008', 'Refrigerated', 'ColdChain Rx Logistics', 'COLD-01', 1380.00, 54, 14, 6, 18),
      ('SYR-10ML', 'Syringe 10mL Sterile', 'pcs', '4801234500009', 'Consumables', 'Summit Biocare', 'WH-C1', 12.50, 2450, 40, 0, 180),
      ('GLOVES-NIT-M', 'Nitrile Gloves Medium', 'box', '4801234500010', 'Consumables', 'Summit Biocare', 'WH-C1', 185.00, 330, 20, 0, 40),
      ('THERM-DIGI', 'Digital Thermometer', 'pcs', '4801234500011', 'Devices', 'Pacific Wellness Labs', 'WH-D1', 420.00, 78, 6, 0, 10),
      ('BP-AUTO', 'Automatic BP Monitor', 'pcs', '4801234500012', 'Devices', 'Pacific Wellness Labs', 'WH-D1', 1650.00, 24, 4, 0, 6)
  ) as seed(
    sku, product_name, unit, barcode, category_name, supplier, warehouse_location,
    unit_price, inventory_on_hand, reserved_stock, quarantine_stock, low_stock_threshold
  )
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
  sp.supplier,
  sp.warehouse_location,
  sp.unit_price,
  sp.inventory_on_hand,
  cm.id,
  'PHP',
  sp.reserved_stock,
  sp.quarantine_stock,
  sp.low_stock_threshold
from seed_products sp
left join category_map cm on lower(cm.category_name) = lower(sp.category_name)
where not exists (
  select 1
  from public.products p
  where lower(p.sku) = lower(sp.sku)
);

-- 5) Active pricing for reports and product detail panels
with seed_pricing as (
  select *
  from (
    values
      ('AMOX-500-CAP', 14.20, 18.75, '2026-03-01'::date),
      ('AZI-500-TAB', 33.10, 42.50, '2026-03-01'::date),
      ('PARA-500-TAB', 2.10, 2.85, '2026-03-01'::date),
      ('IBU-200-TAB', 3.60, 4.95, '2026-03-01'::date),
      ('LOSA-50-TAB', 5.90, 7.50, '2026-03-01'::date),
      ('AMLO-5-TAB', 4.90, 6.20, '2026-03-01'::date),
      ('METF-500-TAB', 3.05, 3.95, '2026-03-01'::date),
      ('INS-GLAR-100-PEN', 1240.00, 1380.00, '2026-03-01'::date),
      ('SYR-10ML', 8.60, 12.50, '2026-03-01'::date),
      ('GLOVES-NIT-M', 150.00, 185.00, '2026-03-01'::date),
      ('THERM-DIGI', 340.00, 420.00, '2026-03-01'::date),
      ('BP-AUTO', 1320.00, 1650.00, '2026-03-01'::date)
  ) as seed(sku, cost_price, selling_price, effective_from)
)
insert into public.product_pricing (
  product_id,
  cost_price,
  selling_price,
  currency_code,
  effective_from,
  created_by,
  is_active
)
select
  p.product_id,
  sp.cost_price,
  sp.selling_price,
  'PHP',
  sp.effective_from,
  'demo-seed',
  true
from seed_pricing sp
join public.products p on lower(p.sku) = lower(sp.sku)
where not exists (
  select 1
  from public.product_pricing pp
  where pp.product_id = p.product_id
    and pp.effective_from = sp.effective_from
    and pp.is_active = true
);

-- 6) Purchase orders for funnel, customs, transit, and dashboard
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
  is_late,
  carrier_name,
  carrier_tracking_ref,
  transit_updated_at,
  transit_updated_by,
  transit_notes
)
select *
from (
  values
    ('PO-MAY26-001', 'HealthMed Supply', 'Received', '2026-05-02 09:10+08'::timestamptz, '2026-05-02 09:10+08'::timestamptz, '2026-05-09 14:20+08'::timestamptz, '2026-05-09'::date, 284500, 'Approved', '2026-05-02 13:00+08'::timestamp, 'manual', 'Amoxicillin and paracetamol replenishment', 'Received', 'Air', 8200, null::timestamptz, null::timestamptz, 0, false, 'LBC Air Cargo', 'LBC-MAY26-001', '2026-05-09 16:00+08'::timestamptz, 'Demo Seeder', 'Delivered to receiving dock'),
    ('PO-MAY26-002', 'HealthMed Supply', 'Approved', '2026-05-07 10:30+08'::timestamptz, '2026-05-07 10:30+08'::timestamptz, null::timestamptz, '2026-05-22'::date, 176800, 'Approved', '2026-05-07 15:10+08'::timestamp, 'manual', 'Antihypertensive safety stock', 'In Transit', 'Air', 6400, null::timestamptz, null::timestamptz, 0, false, '2GO Express', '2GO-MAY26-002', '2026-05-18 11:10+08'::timestamptz, 'Demo Seeder', 'Departed supplier hub'),
    ('PO-MAY26-003', 'MediCore Pharma', 'Pending Supplier Confirmation', '2026-05-11 11:45+08'::timestamptz, '2026-05-11 11:45+08'::timestamptz, null::timestamptz, '2026-05-28'::date, 412300, 'Pending', null::timestamp, 'manual', 'Diabetes and maintenance medication coverage', null, 'Sea', 11900, null::timestamptz, null::timestamptz, 0, false, null, null, null, null, null),
    ('PO-MAY26-004', 'ColdChain Rx Logistics', 'Quality Check', '2026-05-13 08:15+08'::timestamptz, '2026-05-13 08:15+08'::timestamptz, null::timestamptz, '2026-05-18'::date, 298600, 'Approved', '2026-05-13 10:05+08'::timestamp, 'manual', 'Insulin cold-chain replenishment', 'Quality Check', 'Air', 15400, null::timestamptz, null::timestamptz, 0, false, 'Air21 Pharma', 'AIR-MAY26-004', '2026-05-18 09:10+08'::timestamptz, 'Demo Seeder', 'Handed over for cold-room inspection'),
    ('PO-MAY26-005', 'NorthStar Generics', 'Approved', '2026-05-15 16:40+08'::timestamptz, '2026-05-15 16:40+08'::timestamptz, null::timestamptz, '2026-06-02'::date, 219750, 'Approved', '2026-05-16 09:00+08'::timestamp, 'manual', 'Antibiotic generic alternatives', 'Stuck at Customs', 'Sea', 9900, '2026-05-12 09:00+08'::timestamptz, null::timestamptz, 18500, true, 'Maersk', 'SEA-MAY26-005', '2026-05-19 14:20+08'::timestamptz, 'Demo Seeder', 'Awaiting customs release documents'),
    ('PO-MAY26-006', 'Summit Biocare', 'Confirmed', '2026-05-17 13:05+08'::timestamptz, '2026-05-17 13:05+08'::timestamptz, null::timestamptz, '2026-05-26'::date, 96500, 'Approved', '2026-05-17 16:15+08'::timestamp, 'manual', 'Consumables replenishment for ward kits', 'Packaging (Supplier)', 'Air', 3900, null::timestamptz, null::timestamptz, 0, false, 'JRS Express', 'JRS-MAY26-006', '2026-05-19 10:40+08'::timestamptz, 'Demo Seeder', 'Supplier packed and awaiting pickup')
) as seed(
  po_no, supplier_name, status, created_at, reserved_at, paid_at, expected_delivery_date,
  total_value, approval_status, approved_at, import_source, notes, transit_status,
  freight_mode, freight_cost, customs_entry_date, customs_release_date, duties_paid,
  is_late, carrier_name, carrier_tracking_ref, transit_updated_at, transit_updated_by, transit_notes
)
where not exists (
  select 1 from public.purchase_orders po where po.po_no = seed.po_no
);

-- 7) PO items
insert into public.purchase_order_items (po_id, item_name, quantity, unit_price)
select po.po_id, seed.item_name, seed.quantity, seed.unit_price
from (
  values
    ('PO-MAY26-001', 'Amoxicillin 500mg Capsule', 1200, 18.75),
    ('PO-MAY26-001', 'Paracetamol 500mg Tablet', 3000, 2.85),
    ('PO-MAY26-002', 'Losartan 50mg Tablet', 1600, 7.50),
    ('PO-MAY26-002', 'Amlodipine 5mg Tablet', 1500, 6.20),
    ('PO-MAY26-003', 'Metformin 500mg Tablet', 2200, 3.95),
    ('PO-MAY26-004', 'Insulin Glargine 100IU/mL Pen', 180, 1380.00),
    ('PO-MAY26-005', 'Azithromycin 500mg Tablet', 900, 42.50),
    ('PO-MAY26-006', 'Syringe 10mL Sterile', 2200, 12.50),
    ('PO-MAY26-006', 'Nitrile Gloves Medium', 180, 185.00)
) as seed(po_no, item_name, quantity, unit_price)
join public.purchase_orders po on po.po_no = seed.po_no
where not exists (
  select 1
  from public.purchase_order_items poi
  where poi.po_id = po.po_id
    and lower(poi.item_name) = lower(seed.item_name)
);

-- 8) PO status history for timeline UI
insert into public.po_status_history (po_id, status_name, changed_at, reason)
select po.po_id, seed.status_name, seed.changed_at, seed.reason
from (
  values
    ('PO-MAY26-001', 'Pending Supplier Confirmation', '2026-05-02 09:10+08'::timestamptz, 'PO created'),
    ('PO-MAY26-001', 'Confirmed', '2026-05-02 12:40+08'::timestamptz, 'Supplier accepted order'),
    ('PO-MAY26-001', 'Received', '2026-05-09 15:30+08'::timestamptz, 'Goods received in warehouse'),
    ('PO-MAY26-002', 'Pending Supplier Confirmation', '2026-05-07 10:30+08'::timestamptz, 'PO created'),
    ('PO-MAY26-002', 'Confirmed', '2026-05-07 17:00+08'::timestamptz, 'Supplier accepted order'),
    ('PO-MAY26-002', 'In-Transit', '2026-05-18 11:10+08'::timestamptz, 'Goods dispatched from supplier'),
    ('PO-MAY26-004', 'Pending Supplier Confirmation', '2026-05-13 08:15+08'::timestamptz, 'PO created'),
    ('PO-MAY26-004', 'Receiving', '2026-05-18 08:45+08'::timestamptz, 'Goods arrived at cold-chain bay'),
    ('PO-MAY26-004', 'Quality Check', '2026-05-18 09:30+08'::timestamptz, 'QC hold for temperature review'),
    ('PO-MAY26-005', 'Pending Supplier Confirmation', '2026-05-15 16:40+08'::timestamptz, 'PO created'),
    ('PO-MAY26-005', 'In-Transit', '2026-05-17 12:10+08'::timestamptz, 'Shipment boarded vessel'),
    ('PO-MAY26-005', 'Stuck at Customs', '2026-05-19 14:20+08'::timestamptz, 'Customs clearance pending')
) as seed(po_no, status_name, changed_at, reason)
join public.purchase_orders po on po.po_no = seed.po_no
where not exists (
  select 1
  from public.po_status_history hist
  where hist.po_id = po.po_id
    and hist.status_name = seed.status_name
    and hist.changed_at = seed.changed_at
);

commit;
