CREATE TABLE IF NOT EXISTS public.freight_quotes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id uuid NOT NULL,
  po_no text NOT NULL,
  provider text NOT NULL,
  freight_type text NOT NULL,
  cost numeric NOT NULL,
  estimated_days integer NOT NULL,
  is_winner boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.freight_quotes
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_freight_quotes"
  ON public.freight_quotes FOR ALL
  TO anon, authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transit_status text
  DEFAULT 'pending'
  CHECK (
    transit_status IN (
      'pending',
      'confirmed',
      'dispatched',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'customs_released',
      'out_for_delivery',
      'arrived_warehouse',
      'received'
    )
  );

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transit_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS transit_updated_by text,
  ADD COLUMN IF NOT EXISTS transit_notes text,
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS carrier_tracking_ref text;
