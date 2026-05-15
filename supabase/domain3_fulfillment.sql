-- Domain 3: Fulfillment
-- Target project: dkqvbyewfyzfmisyisgs

-- 1. Retail Orders Table
CREATE TABLE IF NOT EXISTS public.retail_orders (
    order_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no text DEFAULT ('RO-' || substring(gen_random_uuid()::text, 1, 8)) UNIQUE,
    retailer_name text NOT NULL DEFAULT 'Unknown',
    status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'approved', 'payment_pending', 'dispatched', 'fulfilled', 'cancelled')),
    total_amount numeric NOT NULL DEFAULT 0,
    payment_terms text,
    due_date date,
    notes text,
    priority_level text DEFAULT 'Normal' CHECK (priority_level IN ('Normal', 'High', 'Urgent')),
    branch_suffix text,
    priority_rank integer DEFAULT 3,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add priority_rank computed logic via trigger if missing
CREATE OR REPLACE FUNCTION public.set_priority_rank()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_rank := CASE
    WHEN NEW.priority_level = 'Urgent' THEN 1
    WHEN NEW.priority_level = 'High' THEN 2
    ELSE 3
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_retail_orders_priority_rank ON public.retail_orders;
CREATE TRIGGER trg_retail_orders_priority_rank
BEFORE INSERT OR UPDATE OF priority_level ON public.retail_orders
FOR EACH ROW EXECUTE FUNCTION public.set_priority_rank();


-- 2. Retail Order Lines Table
CREATE TABLE IF NOT EXISTS public.retail_order_lines (
    line_uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_uuid uuid REFERENCES public.retail_orders(order_uuid) ON DELETE CASCADE,
    sku text NOT NULL,
    qty integer NOT NULL CHECK (qty > 0),
    unit_price numeric DEFAULT 0,
    line_total numeric GENERATED ALWAYS AS (qty * unit_price) STORED,
    qty_fulfilled integer DEFAULT 0,
    qty_backordered integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 3. Backorder Alerts Table
CREATE TABLE IF NOT EXISTS public.backorder_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sku text NOT NULL,
    grn_reference text,
    pending_backorder_count integer NOT NULL DEFAULT 0,
    message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Backorders Table (Legacy Schema)
CREATE TABLE IF NOT EXISTS public.backorders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  qty_needed integer NOT NULL CHECK (qty_needed > 0),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status IN ('pending', 'fulfilled')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  order_uuid uuid REFERENCES public.retail_orders(order_uuid),
  line_uuid uuid, -- Could link to retail_order_lines if exists
  order_no text,
  retailer_name text,
  qty_backordered integer NOT NULL,
  resolved_at timestamp with time zone,
  last_alerted_at timestamp with time zone
);

-- 5. Backorder Aging View
CREATE OR REPLACE VIEW public.v_backorder_aging AS
SELECT 
    id as backorder_id,
    order_uuid, 
    order_no,
    retailer_name,
    sku,
    qty_backordered,
    created_at,
    extract(day from now() - created_at) as age_days,
    status as latest_status
FROM public.backorders;

