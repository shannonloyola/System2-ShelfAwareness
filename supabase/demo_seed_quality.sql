-- Demo seed: Quality and Compliance project
-- Run this in Supabase project: jbfzhlalkjbtbitvxeog
-- Supports: discrepancy/QC flows, supplier analytics, approvals, risk tabs

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 0) Minimal dependency and domain tables for self-contained demo seeding
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  currency_code text not null default 'PHP',
  lead_time_days integer not null check (lead_time_days > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text not null default 'Active'
    check (status in ('Active', 'Suspended'))
);

create table if not exists public.purchase_orders (
  po_id uuid primary key default gen_random_uuid(),
  po_no text not null unique,
  supplier_name text not null,
  status text not null default 'Pending Supplier Confirmation',
  created_at timestamptz not null default now(),
  reserved_at timestamptz default now(),
  expires_at timestamptz,
  reservation_hours integer not null default 24,
  paid_at timestamptz,
  expected_delivery_date date not null,
  preferred_communication text
    check (
      preferred_communication is null
      or preferred_communication in ('whatsapp', 'viber', 'email')
    ),
  total_value numeric default 0,
  approval_status text default 'Pending'
    check (approval_status in ('Pending', 'Approved', 'Rejected')),
  approved_by uuid,
  approved_at timestamp,
  created_by uuid,
  import_source text default 'manual'
    check (import_source in ('manual', 'csv_import')),
  notes text,
  transit_status text,
  freight_mode text check (freight_mode in ('Air', 'Sea')),
  freight_cost numeric,
  freight_type text,
  customs_entry_date timestamptz,
  customs_release_date timestamptz,
  duties_paid numeric,
  landed_costs_posted_at timestamptz,
  is_late boolean default false,
  rejection_reason text,
  rejected_at timestamptz
);

create table if not exists public.shipment_discrepancies (
  id uuid primary key default gen_random_uuid(),
  grn_reference text not null,
  shipment_reference text,
  product_sku text not null,
  product_name text not null,
  batch_number text not null,
  system_count integer not null check (system_count >= 0),
  physical_count integer not null check (physical_count >= 0),
  discrepancy_units integer not null check (discrepancy_units >= 0),
  reason_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reported_by text,
  reported_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  severity text check (severity in ('Minor', 'Major', 'Critical')),
  evidence_urls jsonb not null default '[]'::jsonb,
  supplier_name text,
  disposition_action text check (
    disposition_action in (
      'Return to Supplier',
      'Quarantine',
      'Write Off',
      'Accept Variance',
      'Re-count'
    )
  ),
  disposition text check (disposition in ('released', 'returned', 'scrapped'))
);

create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  audit_date date not null,
  compliance_status text not null
    check (compliance_status in ('Compliant', 'Non-Compliant', 'Under Review')),
  findings text,
  assessor_name text not null,
  risk_notes text,
  risk_level text not null default 'Low'
    check (risk_level in ('Low', 'Medium', 'High')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.supplier_scorecard_cache (
  supplier_key text primary key,
  supplier_name text not null,
  total_pos integer not null default 0,
  approved_pos integer not null default 0,
  po_approval_rate numeric(5,2) not null default 0,
  total_receipts integer not null default 0,
  on_time_receipts integer not null default 0,
  on_time_delivery_pct numeric(5,2) not null default 0,
  total_discrepancies integer not null default 0,
  approved_discrepancies integer not null default 0,
  rejected_discrepancies integer not null default 0,
  avg_discrepancy_units numeric(10,2) not null default 0,
  defect_rate numeric(5,2) not null default 0,
  reliability_score numeric(5,2) not null default 0,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  risk_summary text,
  source_month date,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id integer not null,
  sku text not null,
  product_name text not null,
  qty_before integer not null,
  qty_change integer not null,
  qty_after integer not null,
  reason text not null check (char_length(reason) >= 10),
  reason_category text not null check (
    reason_category in (
      'Damaged Goods',
      'Count Correction',
      'Theft/Loss',
      'Expiry Write-off',
      'System Error',
      'Other'
    )
  ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  approved_by text,
  approved_at timestamptz,
  rejection_note text,
  created_at timestamptz not null default now(),
  movement_type text not null default 'MANUAL_ADJUSTMENT'
);

create table if not exists public.qc_inspections (
  inspection_id bigint generated always as identity primary key,
  grn_id bigint not null,
  inspector_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'passed', 'failed', 'requires_review')),
  checklist_data jsonb not null default '{}'::jsonb,
  inspected_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  result text
);

create table if not exists public.grn_quality_checks (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null,
  checks jsonb not null,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- 1) Suppliers mirrored for scorecard and assessment context
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
    ('Summit Biocare', 'Erika Dizon', 'orders@summitbiocare.ph', '+63 917 630 1400', 'Pasig City, Philippines', 'PHP', 9, 'Active')
) as seed(supplier_name, contact_person, email, phone, address, currency_code, lead_time_days, status)
where not exists (
  select 1 from public.suppliers s where lower(s.supplier_name) = lower(seed.supplier_name)
);

insert into public.purchase_orders (
  po_no,
  supplier_name,
  status,
  created_at,
  expected_delivery_date,
  total_value,
  approval_status,
  notes,
  transit_status,
  freight_mode,
  is_late
)
select *
from (
  values
    ('PO-MAY26-001', 'HealthMed Supply', 'Received', '2026-05-02 09:10+08'::timestamptz, '2026-05-09'::date, 284500, 'Approved', 'Reference row for quality correlation', 'Received', 'Air', false),
    ('PO-MAY26-004', 'ColdChain Rx Logistics', 'Quality Check', '2026-05-13 08:15+08'::timestamptz, '2026-05-18'::date, 298600, 'Approved', 'Reference row for discrepancy analysis', 'Quality Check', 'Air', false),
    ('PO-MAY26-005', 'NorthStar Generics', 'Approved', '2026-05-15 16:40+08'::timestamptz, '2026-06-02'::date, 219750, 'Approved', 'Reference row for risk and delay impact', 'Stuck at Customs', 'Sea', true)
) as seed(po_no, supplier_name, status, created_at, expected_delivery_date, total_value, approval_status, notes, transit_status, freight_mode, is_late)
where not exists (
  select 1 from public.purchase_orders po where po.po_no = seed.po_no
);

-- 2) Receiving discrepancy rows
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
  reviewed_by,
  reviewed_at,
  review_notes,
  created_at,
  updated_at,
  severity,
  evidence_urls,
  supplier_name,
  disposition_action,
  disposition
)
select *
from (
  values
    ('GRN-MAY26-001', 'TRK-MAY26-001', 'AMOX-500-CAP', 'Amoxicillin 500mg Capsule', 'AMX0526A', 1200, 1194, 6, 'SHORT_SHIP', 'approved', 'warehouse.qa', '2026-05-09 15:00+08'::timestamptz, 'Quality Manager', '2026-05-09 17:15+08'::timestamptz, 'Accepted minor variance after recount.', '2026-05-09 15:00+08'::timestamptz, '2026-05-09 17:15+08'::timestamptz, 'Minor', '["https://example.com/evidence/amox-1.jpg"]'::jsonb, 'HealthMed Supply', 'Accept Variance', 'released'),
    ('GRN-MAY26-004', 'TRK-MAY26-004', 'INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 'COLD0526B', 180, 176, 4, 'TEMP_EXCURSION', 'pending', 'warehouse.qa', '2026-05-18 10:30+08'::timestamptz, null, null, null, '2026-05-18 10:30+08'::timestamptz, '2026-05-18 10:30+08'::timestamptz, 'Major', '["https://example.com/evidence/insulin-1.jpg","https://example.com/evidence/insulin-2.jpg"]'::jsonb, 'ColdChain Rx Logistics', 'Quarantine', null),
    ('GRN-MAY26-006', 'TRK-MAY26-006', 'GLOVES-NIT-M', 'Nitrile Gloves Medium', 'GLV0526B', 180, 172, 8, 'PACKING_DAMAGE', 'rejected', 'warehouse.qa', '2026-05-26 11:10+08'::timestamptz, 'Quality Manager', '2026-05-26 14:05+08'::timestamptz, 'Damage claim unsupported after recount and carton inspection.', '2026-05-26 11:10+08'::timestamptz, '2026-05-26 14:05+08'::timestamptz, 'Minor', '["https://example.com/evidence/gloves-1.jpg"]'::jsonb, 'Summit Biocare', 'Re-count', null)
) as seed(
  grn_reference, shipment_reference, product_sku, product_name, batch_number,
  system_count, physical_count, discrepancy_units, reason_code, status,
  reported_by, reported_at, reviewed_by, reviewed_at, review_notes,
  created_at, updated_at, severity, evidence_urls, supplier_name,
  disposition_action, disposition
)
where not exists (
  select 1
  from public.shipment_discrepancies sd
  where sd.grn_reference = seed.grn_reference
    and lower(sd.product_sku) = lower(seed.product_sku)
);

-- 3) Risk assessments for supplier analytics
insert into public.risk_assessments (
  supplier_name,
  audit_date,
  compliance_status,
  findings,
  assessor_name,
  risk_notes,
  risk_level
)
select *
from (
  values
    ('HealthMed Supply', '2026-05-10'::date, 'Compliant', 'Minor receipt variance only; documentation complete.', 'QA Lead Demo', 'Low operational risk. Continue monthly monitoring.', 'Low'),
    ('MediCore Pharma', '2026-05-14'::date, 'Under Review', 'Pending recent CAPA evidence for lot traceability.', 'QA Lead Demo', 'Review supplier controls before increasing order mix.', 'Medium'),
    ('ColdChain Rx Logistics', '2026-05-18'::date, 'Non-Compliant', 'Temperature excursion and incomplete cold-chain log on arrival.', 'QA Lead Demo', 'Escalate until cold-room handling controls are validated.', 'High'),
    ('NorthStar Generics', '2026-05-19'::date, 'Under Review', 'Customs delays affecting replenishment continuity.', 'Risk Officer Demo', 'Service reliability risk is medium due to external delays.', 'Medium'),
    ('Summit Biocare', '2026-05-26'::date, 'Compliant', 'Packaging concerns not substantiated after recount.', 'QA Lead Demo', 'Supplier remains acceptable with normal follow-up.', 'Low')
) as seed(supplier_name, audit_date, compliance_status, findings, assessor_name, risk_notes, risk_level)
where not exists (
  select 1
  from public.risk_assessments ra
  where lower(ra.supplier_name) = lower(seed.supplier_name)
    and ra.audit_date = seed.audit_date
);

-- 4) Deterministic scorecard cache for stable demo metrics
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
values
  ('healthmed supply', 'HealthMed Supply', 2, 2, 100.00, 2, 2, 100.00, 1, 1, 0, 6.00, 0.50, 96.00, 'low', 'Reliable May supplier with one minor approved variance.', '2026-05-01'::date, now(), now()),
  ('medicore pharma', 'MediCore Pharma', 1, 0, 0.00, 0, 0, 0.00, 0, 0, 0, 0.00, 0.00, 42.00, 'medium', 'Approval still pending and no May receipt closed yet.', '2026-05-01'::date, now(), now()),
  ('coldchain rx logistics', 'ColdChain Rx Logistics', 1, 1, 100.00, 1, 0, 0.00, 1, 0, 0, 4.00, 2.22, 38.00, 'high', 'Cold-chain discrepancy is actively holding supplier reliability down.', '2026-05-01'::date, now(), now()),
  ('northstar generics', 'NorthStar Generics', 1, 1, 100.00, 0, 0, 0.00, 0, 0, 0, 0.00, 0.00, 58.00, 'medium', 'No quality defect yet, but customs delay is increasing supply risk.', '2026-05-01'::date, now(), now()),
  ('summit biocare', 'Summit Biocare', 1, 1, 100.00, 1, 1, 100.00, 1, 0, 1, 8.00, 4.44, 82.00, 'low', 'One rejected discrepancy after recount; otherwise stable.', '2026-05-01'::date, now(), now())
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

-- 5) Stock adjustment workflow depth
insert into public.stock_adjustments (
  product_id,
  sku,
  product_name,
  qty_before,
  qty_change,
  qty_after,
  reason,
  reason_category,
  status,
  requested_by,
  approved_by,
  approved_at,
  rejection_note,
  created_at,
  movement_type
)
select *
from (
  values
    (101, 'PARA-500-TAB', 'Paracetamol 500mg Tablet', 3000, -140, 2860, 'Cycle count confirmed fewer tablets than system balance after recount.', 'Count Correction', 'approved', 'Cycle Counter A', 'Warehouse Manager Demo', '2026-05-18 17:20+08'::timestamptz, null, '2026-05-18 17:05+08'::timestamptz, 'MANUAL_ADJUSTMENT'),
    (102, 'INS-GLAR-100-PEN', 'Insulin Glargine 100IU/mL Pen', 22, -4, 18, 'Four pens moved to quarantine because of temperature excursion review.', 'Damaged Goods', 'pending', 'QC Inspector Demo', null, null, null, '2026-05-18 10:45+08'::timestamptz, 'MANUAL_ADJUSTMENT'),
    (103, 'GLOVES-NIT-M', 'Nitrile Gloves Medium', 258, -8, 250, 'Packing damage claim was reviewed and not supported by final recount.', 'Other', 'rejected', 'Warehouse Demo', 'Warehouse Manager Demo', '2026-05-26 14:10+08'::timestamptz, 'Damage evidence did not support stock write-off.', '2026-05-26 11:20+08'::timestamptz, 'MANUAL_ADJUSTMENT')
) as seed(
  product_id, sku, product_name, qty_before, qty_change, qty_after, reason,
  reason_category, status, requested_by, approved_by, approved_at,
  rejection_note, created_at, movement_type
)
where not exists (
  select 1
  from public.stock_adjustments sa
  where lower(sa.sku) = lower(seed.sku)
    and sa.created_at = seed.created_at
);

-- 6) QC inspections and checklist-style evidence
insert into public.qc_inspections (
  grn_id,
  inspector_name,
  status,
  checklist_data,
  inspected_at,
  created_at,
  updated_at,
  result
)
select *
from (
  values
    (1001, 'QC Inspector Demo', 'passed', '{"packaging":"passed","count_match":"passed","labeling":"passed"}'::jsonb, '2026-05-09 16:00+08'::timestamptz, '2026-05-09 16:00+08'::timestamptz, '2026-05-09 16:00+08'::timestamptz, 'Routine receiving inspection passed.'),
    (1004, 'QC Inspector Demo', 'failed', '{"packaging":"passed","count_match":"failed","temperature_log":"failed"}'::jsonb, '2026-05-18 10:35+08'::timestamptz, '2026-05-18 10:35+08'::timestamptz, '2026-05-18 10:35+08'::timestamptz, 'Cold-chain discrepancy requires management review.'),
    (1006, 'QC Inspector Demo', 'requires_review', '{"packaging":"warning","count_match":"warning","seal_condition":"passed"}'::jsonb, '2026-05-26 11:40+08'::timestamptz, '2026-05-26 11:40+08'::timestamptz, '2026-05-26 11:40+08'::timestamptz, 'Recount and documentation review performed before final disposition.')
) as seed(grn_id, inspector_name, status, checklist_data, inspected_at, created_at, updated_at, result)
where not exists (
  select 1
  from public.qc_inspections qi
  where qi.grn_id = seed.grn_id
    and qi.inspected_at = seed.inspected_at
);

insert into public.grn_quality_checks (
  grn_id,
  checks,
  notes,
  photo_url,
  created_at
)
select *
from (
  values
    ('11111111-1111-1111-1111-111111111001'::uuid, '{"seal":"pass","count":"pass","appearance":"pass"}'::jsonb, 'Receiving inspection completed with no major issues.', 'https://example.com/qc/grn-may26-001.jpg', '2026-05-09 16:05+08'::timestamptz),
    ('11111111-1111-1111-1111-111111111004'::uuid, '{"seal":"pass","count":"fail","temperature":"fail"}'::jsonb, 'Temperature excursion and count variance noted on arrival.', 'https://example.com/qc/grn-may26-004.jpg', '2026-05-18 10:36+08'::timestamptz)
) as seed(grn_id, checks, notes, photo_url, created_at)
where not exists (
  select 1
  from public.grn_quality_checks gqc
  where gqc.grn_id = seed.grn_id
    and gqc.created_at = seed.created_at
);

commit;
