-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This patch adds missing columns to the shipments table for Phase 1 SCM integration.

DO $$ 
BEGIN 
    -- 1. Add po_no column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='po_no') THEN
        ALTER TABLE public.shipments ADD COLUMN po_no text;
        RAISE NOTICE 'Added column po_no to public.shipments';
    END IF;

    -- 2. Add supplier_name column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='supplier_name') THEN
        ALTER TABLE public.shipments ADD COLUMN supplier_name text;
        RAISE NOTICE 'Added column supplier_name to public.shipments';
    END IF;

    -- 3. Add expected_items column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='expected_items') THEN
        ALTER TABLE public.shipments ADD COLUMN expected_items jsonb;
        RAISE NOTICE 'Added column expected_items to public.shipments';
    END IF;

    -- 4. Add tracking_number column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='tracking_number') THEN
        ALTER TABLE public.shipments ADD COLUMN tracking_number text;
        RAISE NOTICE 'Added column tracking_number to public.shipments';
    END IF;

    -- 5. Add received_at column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='received_at') THEN
        ALTER TABLE public.shipments ADD COLUMN received_at timestamptz;
        RAISE NOTICE 'Added column received_at to public.shipments';
    END IF;

    -- 6. Add received_by column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='received_by') THEN
        ALTER TABLE public.shipments ADD COLUMN received_by text;
        RAISE NOTICE 'Added column received_by to public.shipments';
    END IF;

    -- 7. Add notes column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='notes') THEN
        ALTER TABLE public.shipments ADD COLUMN notes text;
        RAISE NOTICE 'Added column notes to public.shipments';
    END IF;
END $$;

-- 5. Add unique constraint to tracking_number if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name='shipments' 
          AND constraint_name='shipments_tracking_number_key'
    ) THEN
        ALTER TABLE public.shipments ADD CONSTRAINT shipments_tracking_number_key UNIQUE (tracking_number);
        RAISE NOTICE 'Added unique constraint to tracking_number';
    END IF;
END $$;

-- 6. Trigger schema cache reload for PostgREST
NOTIFY pgrst, 'reload schema';

-- 7. Enable RLS and add public access policies
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service full access on shipments" ON public.shipments;
CREATE POLICY "Allow service full access on shipments"
    ON public.shipments FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

