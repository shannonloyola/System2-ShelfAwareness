-- Create payments table for supplier payment history
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_insert_payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_supplier ON public.payments(supplier_name);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date DESC);