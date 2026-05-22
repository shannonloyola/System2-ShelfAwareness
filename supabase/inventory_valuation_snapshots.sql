-- Inventory valuation snapshots
-- Run this in the Fulfillment / Distribution Supabase project.
-- Purpose: persist real daily inventory valuation history for the executive dashboard.

begin;

create table if not exists public.inventory_valuation_snapshots (
  snapshot_date date primary key,
  total_inventory_value_php numeric(14,2) not null check (total_inventory_value_php >= 0),
  category_values jsonb not null default '[]'::jsonb,
  sku_count integer,
  critical_sku_count integer,
  source text not null default 'distribution-service',
  notes text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_valuation_snapshots_generated_at
  on public.inventory_valuation_snapshots (generated_at desc);

create or replace function public.set_inventory_valuation_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inventory_valuation_snapshots_updated_at
  on public.inventory_valuation_snapshots;

create trigger trg_inventory_valuation_snapshots_updated_at
before update on public.inventory_valuation_snapshots
for each row
execute function public.set_inventory_valuation_snapshots_updated_at();

alter table public.inventory_valuation_snapshots enable row level security;

drop policy if exists "Allow anon/auth read inventory valuation snapshots"
  on public.inventory_valuation_snapshots;
create policy "Allow anon/auth read inventory valuation snapshots"
  on public.inventory_valuation_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow service management for inventory valuation snapshots"
  on public.inventory_valuation_snapshots;
create policy "Allow service management for inventory valuation snapshots"
  on public.inventory_valuation_snapshots
  for all
  to anon, authenticated
  using (true)
  with check (true);

commit;
