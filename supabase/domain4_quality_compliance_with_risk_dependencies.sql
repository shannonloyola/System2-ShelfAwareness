-- Domain 4 + dependencies for risk-compliance
-- Target project: jbfzhlalkjbtbitvxeog
-- Safe to run in Supabase SQL Editor.
-- This pack is designed to support:
--   - discrepancy-qc-service
--   - stock-adjustment-service
--   - risk-compliance-service
-- Plus the minimum dependency subset needed by risk-compliance:
--   - suppliers
--   - purchase_orders

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

-- =========================================================
-- Dependency subset for risk-compliance
-- =========================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  currency_code text not null,
  lead_time_days integer not null check (lead_time_days > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  status text not null default 'Active'
    check (status in ('Active', 'Suspended'))
);

create index if not exists idx_suppliers_supplier_name
  on public.suppliers (supplier_name);

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

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

create index if not exists idx_purchase_orders_supplier_name
  on public.purchase_orders (supplier_name);

create index if not exists idx_purchase_orders_status
  on public.purchase_orders (status);

create index if not exists idx_purchase_orders_approval_status
  on public.purchase_orders (approval_status);

-- =========================================================
-- Domain 4: Discrepancy / QC
-- =========================================================

create table if not exists public.grn_quality_checks (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid not null,
  checks jsonb not null,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_grn_quality_checks_grn_id
  on public.grn_quality_checks (grn_id);

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

create index if not exists idx_shipment_discrepancies_supplier_name
  on public.shipment_discrepancies (supplier_name);

create index if not exists idx_shipment_discrepancies_status
  on public.shipment_discrepancies (status);

create trigger trg_shipment_discrepancies_updated_at
before update on public.shipment_discrepancies
for each row
execute function public.set_updated_at();

-- =========================================================
-- Domain 4: Risk & Compliance
-- =========================================================

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

create index if not exists idx_risk_assessments_supplier_name
  on public.risk_assessments (supplier_name);

create trigger trg_risk_assessments_updated_at
before update on public.risk_assessments
for each row
execute function public.set_updated_at();

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

create index if not exists idx_supplier_scorecard_cache_supplier_name
  on public.supplier_scorecard_cache (supplier_name);

create trigger trg_supplier_scorecard_cache_updated_at
before update on public.supplier_scorecard_cache
for each row
execute function public.set_updated_at();

-- =========================================================
-- Domain 4: Stock Adjustment
-- =========================================================

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

create index if not exists idx_stock_adjustments_status
  on public.stock_adjustments (status);

create index if not exists idx_stock_adjustments_created_at
  on public.stock_adjustments (created_at desc);

create or replace function public.approve_stock_adjustment(
  p_adjustment_id uuid,
  p_manager_name text
)
returns jsonb
language plpgsql
as $$
declare
  v_row public.stock_adjustments;
begin
  update public.stock_adjustments
  set
    status = 'approved',
    approved_by = p_manager_name,
    approved_at = now(),
    rejection_note = null
  where id = p_adjustment_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Stock adjustment not found or not pending';
  end if;

  return jsonb_build_object(
    'approved', true,
    'id', v_row.id,
    'status', v_row.status
  );
end;
$$;

create or replace function public.reject_stock_adjustment(
  p_adjustment_id uuid,
  p_manager_name text,
  p_rejection_note text
)
returns jsonb
language plpgsql
as $$
declare
  v_row public.stock_adjustments;
begin
  update public.stock_adjustments
  set
    status = 'rejected',
    approved_by = p_manager_name,
    approved_at = now(),
    rejection_note = p_rejection_note
  where id = p_adjustment_id
    and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Stock adjustment not found or not pending';
  end if;

  return jsonb_build_object(
    'rejected', true,
    'id', v_row.id,
    'status', v_row.status
  );
end;
$$;

-- =========================================================
-- Optional seed rows for smoke testing
-- =========================================================

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
values (
  'Test Supplier (Japan)',
  'System Seeder',
  'supplier@example.com',
  '+63-900-000-0000',
  'Seed Address',
  'JPY',
  7,
  'Active'
)
on conflict do nothing;

insert into public.risk_assessments (
  supplier_name,
  audit_date,
  compliance_status,
  findings,
  assessor_name,
  risk_notes,
  risk_level
)
values (
  'Test Supplier (Japan)',
  current_date,
  'Under Review',
  'Initial migration validation',
  'System Seeder',
  'Seeded for Domain 4 smoke testing',
  'Medium'
)
on conflict do nothing;
