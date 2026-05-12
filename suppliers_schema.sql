-- Create suppliers table for store supplier records
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  currency_code TEXT NOT NULL,
  lead_time_days INTEGER NOT NULL CHECK (lead_time_days > 0),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable Row Level Security and allow supplier-service REST fallback access.
-- If a matching Domain 2 service-role key is configured, that key bypasses RLS.
-- Local fallback currently uses the Supply Chain anon key, so anon needs CRUD here.
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "allow_insert_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "allow_update_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "allow_delete_suppliers" ON public.suppliers;

CREATE POLICY "allow_read_suppliers"
  ON public.suppliers
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_insert_suppliers"
  ON public.suppliers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "allow_update_suppliers"
  ON public.suppliers
  FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "allow_delete_suppliers"
  ON public.suppliers
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(supplier_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_currency ON public.suppliers(currency_code);

INSERT INTO public.suppliers (
  supplier_name,
  contact_person,
  email,
  phone,
  address,
  currency_code,
  lead_time_days,
  status
)
SELECT
  'HealthMed Supply',
  'Supplier Desk',
  'healthmed@example.com',
  '+63 900 000 0000',
  'Manila, Philippines',
  'PHP',
  7,
  'Active'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.suppliers
  WHERE lower(supplier_name) = lower('HealthMed Supply')
);
