-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This script fixes the 404 errors for reporting views and the products table.

-- 1. Products Table (Cache for Fulfillment)
CREATE TABLE IF NOT EXISTS public.products (
    product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Maps to product_uuid in SCM
    sku text NOT NULL UNIQUE,
    product_name text,
    category text,
    warehouse_location text,
    unit_price numeric DEFAULT 0,
    currency_code text DEFAULT 'PHP',
    created_at timestamptz DEFAULT now()
);

-- 2. Movement Report View
-- This view simplifies queries against inventory_movements
CREATE OR REPLACE VIEW public.movement_report AS
SELECT 
    id,
    sku,
    product_name,
    movement_type,
    direction,
    qty,
    stock_before,
    stock_after,
    reference,
    notes,
    created_at
FROM public.inventory_movements;

-- 3. Products with Inventory View
-- Aggregates inventory across all bins for a single product
CREATE OR REPLACE VIEW public.v_products_with_inventory AS
SELECT 
    product_id,
    SUM(qty_on_hand) as qty_on_hand,
    MAX(updated_at) as updated_at
FROM public.inventory_on_hand
GROUP BY product_id;

-- 4. Latest Product Cost Price View
-- For valuation purposes. 
-- In this project, we can derive it from the latest inventory movement reference 
-- or just default it if not available.
CREATE OR REPLACE VIEW public.v_latest_product_cost_price AS
SELECT 
    product_id,
    unit_price as cost_price
FROM public.products;

-- Explicitly trigger schema cache reload for REST API
NOTIFY pgrst, 'reload schema';
