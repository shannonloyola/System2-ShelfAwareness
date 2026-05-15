-- Add physical_counts table to Fulfillment domain
CREATE TABLE IF NOT EXISTS public.physical_counts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id text,
    sku text NOT NULL,
    product_name text,
    physical_count integer NOT NULL,
    counted_by text,
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    import_source text
);

-- Enable RLS
ALTER TABLE public.physical_counts ENABLE ROW LEVEL SECURITY;

-- Add Public Access policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'physical_counts' 
        AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON public.physical_counts FOR ALL USING (true);
    END IF;
END
$$;

-- Enable Realtime
ALTER publication supabase_realtime ADD TABLE public.physical_counts;
