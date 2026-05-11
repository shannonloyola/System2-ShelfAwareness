-- Domain 2: Supply Chain / Product Catalog + Procurement
-- Target project: wbktqkjdsqrvqxxtitsg
-- Safe to run in Supabase SQL Editor.
-- This pack supports:
--   - ProductMaster
--   - product-catalog-service
--   - pricing reads from retail-orders / outbound distribution
--   - InboundProcurement
--   - PO List

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

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_name_not_blank
    check (length(trim(name)) > 0)
);

create index if not exists idx_product_categories_parent_id
  on public.product_categories (parent_id);

create index if not exists idx_product_categories_name
  on public.product_categories (name);

drop trigger if exists trg_product_categories_updated_at on public.product_categories;
create trigger trg_product_categories_updated_at
before update on public.product_categories
for each row
execute function public.set_updated_at();

create table if not exists public.products (
  product_id bigint generated always as identity primary key,
  sku varchar not null unique,
  product_name varchar not null,
  unit varchar default 'pcs',
  barcode varchar unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text,
  supplier text,
  warehouse_location text,
  unit_price numeric default 0,
  inventory_on_hand integer not null default 0,
  category_id uuid references public.product_categories(id) on delete set null,
  product_uuid uuid not null default gen_random_uuid() unique,
  currency_code text default 'PHP',
  reserved_stock integer not null default 0,
  available_stock integer generated always as (inventory_on_hand - reserved_stock) stored,
  available_to_promise integer generated always as (inventory_on_hand - reserved_stock) stored,
  quarantine_stock integer not null default 0,
  constraint products_sku_not_blank
    check (btrim(sku) <> ''),
  constraint products_product_name_not_blank
    check (btrim(product_name) <> ''),
  constraint products_barcode_format
    check (barcode is null or barcode ~ '^[0-9]{13}$'),
  constraint products_inventory_on_hand_non_negative
    check (inventory_on_hand >= 0),
  constraint products_reserved_stock_non_negative
    check (reserved_stock >= 0),
  constraint products_quarantine_stock_non_negative
    check (quarantine_stock >= 0)
);

create index if not exists idx_products_product_uuid
  on public.products (product_uuid);

create index if not exists idx_products_category_id
  on public.products (category_id);

create index if not exists idx_products_supplier
  on public.products (supplier);

create index if not exists idx_products_created_at
  on public.products (created_at desc);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table if not exists public.product_pricing (
  pricing_id bigint generated always as identity primary key,
  product_id bigint not null references public.products(product_id) on delete cascade,
  cost_price numeric not null,
  selling_price numeric not null,
  currency_code varchar not null default 'PHP'
    check (currency_code in ('JPY', 'USD', 'PHP')),
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz,
  updated_by text,
  is_active boolean not null default true
);

create index if not exists idx_product_pricing_product_id
  on public.product_pricing (product_id);

create index if not exists idx_product_pricing_active
  on public.product_pricing (product_id, is_active, effective_from desc, created_at desc);

create or replace view public.v_latest_product_cost_price as
select distinct on (pp.product_id)
  pp.product_id,
  pp.cost_price,
  pp.selling_price,
  pp.currency_code,
  pp.effective_from,
  pp.effective_to,
  pp.created_at,
  pp.updated_at,
  pp.is_active
from public.product_pricing pp
order by pp.product_id, pp.is_active desc, pp.effective_from desc, pp.created_at desc;

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

create index if not exists idx_purchase_orders_created_at
  on public.purchase_orders (created_at desc);

create index if not exists idx_purchase_orders_po_no
  on public.purchase_orders (po_no);

create index if not exists idx_purchase_orders_supplier_name
  on public.purchase_orders (supplier_name);

create index if not exists idx_purchase_orders_status
  on public.purchase_orders (status);

create index if not exists idx_purchase_orders_approval_status
  on public.purchase_orders (approval_status);

create table if not exists public.purchase_order_items (
  po_item_id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(po_id) on delete cascade,
  item_name text not null,
  quantity integer not null,
  unit_price numeric default 0,
  constraint purchase_order_items_quantity_positive
    check (quantity > 0)
);

create index if not exists idx_purchase_order_items_po_id
  on public.purchase_order_items (po_id);

create table if not exists public.po_status_history (
  history_id bigint generated always as identity primary key,
  po_id uuid not null references public.purchase_orders(po_id) on delete cascade,
  status_name text not null,
  updated_by uuid,
  changed_at timestamptz not null default now(),
  document_url text,
  reason text
);

alter table public.po_status_history
  add column if not exists document_url text;

alter table public.po_status_history
  add column if not exists reason text;

create index if not exists idx_po_status_history_po_id
  on public.po_status_history (po_id);

create index if not exists idx_po_status_history_changed_at
  on public.po_status_history (changed_at desc);

-- Optional starter records so ProductMaster parent category dropdown has values.
insert into public.product_categories (name, parent_id)
select seed.name, seed.parent_id
from (
  values
    ('Pharma', null::uuid),
    ('Medical Supplies', null::uuid),
    ('Cold Chain', null::uuid)
) as seed(name, parent_id)
where not exists (
  select 1
  from public.product_categories existing
  where lower(existing.name) = lower(seed.name)
    and existing.parent_id is not distinct from seed.parent_id
);
