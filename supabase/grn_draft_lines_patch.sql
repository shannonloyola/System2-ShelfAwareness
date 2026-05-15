-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
ALTER TABLE public.grn_draft_lines 
ADD COLUMN IF NOT EXISTS discrepancy_reason text,
ADD COLUMN IF NOT EXISTS batch_number text,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS variance numeric,
ADD COLUMN IF NOT EXISTS product_name text,
ADD COLUMN IF NOT EXISTS sku text;

-- Explicitly trigger schema cache reload for REST API
NOTIFY pgrst, 'reload schema';
