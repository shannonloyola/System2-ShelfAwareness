-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)

-- 1. Ensure Dependencies Exist
CREATE TABLE IF NOT EXISTS public.bins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_on_hand (
    product_id uuid NOT NULL,
    bin_id uuid NOT NULL REFERENCES public.bins(id),
    qty_on_hand numeric NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (product_id, bin_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL,
    sku text,
    product_name text,
    movement_type text,
    direction text,
    qty numeric,
    stock_before numeric,
    stock_after numeric,
    reference text,
    notes text,
    created_by text,
    created_at timestamptz DEFAULT now()
);

-- 2. Comprehensive Patch for Tables
DO $$ 
BEGIN 
    -- Patch inventory_movements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='sku') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN sku text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='product_name') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN product_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='movement_type') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN movement_type text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='direction') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN direction text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='qty') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN qty numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='stock_before') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN stock_before numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='stock_after') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN stock_after numeric;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='reference') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN reference text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='notes') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN notes text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_movements' AND column_name='created_by') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN created_by text;
    END IF;

    -- Patch grn_drafts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grn_drafts' AND column_name='posted_by') THEN
        ALTER TABLE public.grn_drafts ADD COLUMN posted_by text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grn_drafts' AND column_name='posted_at') THEN
        ALTER TABLE public.grn_drafts ADD COLUMN posted_at timestamptz;
    END IF;
END $$;

-- 3. Enable RLS and Grant Policies
ALTER TABLE public.bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_on_hand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access to bins" ON public.bins;
CREATE POLICY "Public access to bins" ON public.bins FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to inventory_on_hand" ON public.inventory_on_hand;
CREATE POLICY "Public access to inventory_on_hand" ON public.inventory_on_hand FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to inventory_movements" ON public.inventory_movements;
CREATE POLICY "Public access to inventory_movements" ON public.inventory_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Enable Realtime for relevant tables
DO $$ 
BEGIN
    -- Add tables to the realtime publication
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Check if table is already in publication to avoid errors
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_on_hand') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_on_hand;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'backorder_alerts') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.backorder_alerts;
        END IF;
    END IF;
END $$;

-- 5. The RPC Function
CREATE OR REPLACE FUNCTION public.post_grn_draft(p_grn_draft_id uuid, p_posted_by text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_grn RECORD;
    v_line RECORD;
    v_lines_processed int := 0;
    v_products_updated int := 0;
    v_movements_inserted int := 0;
    v_stock_before numeric;
    v_stock_after numeric;
    v_default_bin_id uuid;
BEGIN
    -- 1. Check GRN Draft exists
    SELECT * INTO v_grn
    FROM public.grn_drafts
    WHERE id = p_grn_draft_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRN Draft not found');
    END IF;

    IF v_grn.status = 'POSTED' THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRN Draft is already posted');
    END IF;

    -- 2. Get or Create a Default Bin
    SELECT id INTO v_default_bin_id FROM public.bins LIMIT 1;
    
    IF v_default_bin_id IS NULL THEN
        -- Create a default bin if none exists
        INSERT INTO public.bins (name) VALUES ('General Receiving') RETURNING id INTO v_default_bin_id;
    END IF;

    -- 3. Process Lines
    FOR v_line IN (SELECT * FROM public.grn_draft_lines WHERE grn_draft_id = p_grn_draft_id) LOOP
        
        -- Ensure product exists in local fulfillment products cache
        INSERT INTO public.products (product_id, sku, product_name)
        VALUES (v_line.product_id::uuid, v_line.sku, v_line.product_name)
        ON CONFLICT (product_id) DO UPDATE 
        SET sku = EXCLUDED.sku, 
            product_name = EXCLUDED.product_name;

        -- Update inventory_on_hand
        SELECT qty_on_hand, bin_id INTO v_stock_before, v_default_bin_id
        FROM public.inventory_on_hand
        WHERE product_id = v_line.product_id::uuid
        ORDER BY updated_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_stock_after := v_stock_before + v_line.qty_received::numeric;
            
            UPDATE public.inventory_on_hand
            SET qty_on_hand = v_stock_after,
                sku = v_line.sku,
                updated_at = now()
            WHERE product_id = v_line.product_id::uuid
              AND bin_id = v_default_bin_id;
        ELSE
            v_stock_before := 0;
            v_stock_after := v_line.qty_received::numeric;
            
            -- Re-verify we have a bin_id
            IF v_default_bin_id IS NULL THEN
                 SELECT id INTO v_default_bin_id FROM public.bins LIMIT 1;
            END IF;

            INSERT INTO public.inventory_on_hand (
                product_id, sku, qty_on_hand, bin_id
            ) VALUES (
                v_line.product_id::uuid, v_line.sku, v_line.qty_received::numeric, v_default_bin_id
            );
        END IF;

        v_products_updated := v_products_updated + 1;

        -- 4. Detect and Record Discrepancies
        IF v_line.qty_received != v_line.qty_expected THEN
            INSERT INTO public.shipment_discrepancies (
                shipment_reference,
                po_number,
                supplier_name,
                sku,
                product_name,
                expected_qty,
                received_qty,
                discrepancy_reason,
                reported_by,
                status
            ) VALUES (
                v_grn.grn_number, -- Using GRN number as shipment reference for tracking
                NULL, -- PO number is optional or not available in this draft
                'Unknown Supplier', -- Placeholder as supplier_name is not in v_grn
                v_line.sku,
                v_line.product_name,
                v_line.qty_expected::numeric,
                v_line.qty_received::numeric,
                'Quantity mismatch at receiving',
                p_posted_by,
                'pending'
            );
        END IF;

        -- Insert inventory_movements
        INSERT INTO public.inventory_movements (
            product_id,
            sku,
            product_name,
            movement_type,
            direction,
            qty,
            stock_before,
            stock_after,
            reference,
            notes,
            created_by
        ) VALUES (
            v_line.product_id::uuid,
            v_line.sku,
            v_line.product_name,
            'GRN_RECEIPT',
            'IN',
            v_line.qty_received::numeric,
            v_stock_before,
            v_stock_after,
            v_grn.grn_number,
            'GRN Posted by ' || p_posted_by,
            p_posted_by
        );

        v_movements_inserted := v_movements_inserted + 1;
        v_lines_processed := v_lines_processed + 1;
    END LOOP;

    IF v_lines_processed = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'GRN Draft has no line items');
    END IF;

    -- 4. Update GRN Draft status
    UPDATE public.grn_drafts
    SET status = 'POSTED',
        posted_by = p_posted_by,
        posted_at = now()
    WHERE id = p_grn_draft_id;

    -- Return JSON payload
    RETURN jsonb_build_object(
        'success', true,
        'grn_id', p_grn_draft_id,
        'grn_number', v_grn.grn_number,
        'lines_processed', v_lines_processed,
        'products_updated', v_products_updated,
        'movements_inserted', v_movements_inserted,
        'posted_by', p_posted_by,
        'posted_at', now(),
        'status', 'POSTED'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_grn_draft(uuid, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
