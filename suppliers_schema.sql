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

-- Enable Row Level Security and allow authenticated access for now.
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_suppliers"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_insert_suppliers"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "allow_update_suppliers"
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "allow_delete_suppliers"
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(supplier_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_currency ON public.suppliers(currency_code);
