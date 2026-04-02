-- Create delivery_schedules table for warehouse delivery scheduling
CREATE TABLE IF NOT EXISTS public.delivery_schedules (
  id TEXT PRIMARY KEY,
  delivery_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  supplier_name TEXT NOT NULL,
  expected_items_count INTEGER NOT NULL CHECK (expected_items_count > 0),
  warehouse_location TEXT NOT NULL,
  contact_person_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies (adjust as needed for your security requirements)
ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read delivery schedules
CREATE POLICY "allow_read_delivery_schedules"
ON public.delivery_schedules
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert delivery schedules
CREATE POLICY "allow_insert_delivery_schedules"
ON public.delivery_schedules
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update delivery schedules
CREATE POLICY "allow_update_delivery_schedules"
ON public.delivery_schedules
FOR UPDATE
TO authenticated
USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_datetime ON public.delivery_schedules(delivery_datetime);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_supplier ON public.delivery_schedules(supplier_name);
CREATE INDEX IF NOT EXISTS idx_delivery_schedules_status ON public.delivery_schedules(status);