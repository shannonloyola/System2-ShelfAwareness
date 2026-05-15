-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This script provisions the shipment discrepancies workflow in the Fulfillment project.

-- 1. Shipment Discrepancies Table
CREATE TABLE IF NOT EXISTS public.shipment_discrepancies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid,
    shipment_reference text,
    po_number text,
    sku text NOT NULL,
    product_name text,
    expected_qty numeric NOT NULL,
    received_qty numeric NOT NULL,
    discrepancy_reason text,
    discrepancy_type text, -- e.g. 'shortage', 'overage', 'damage'
    reported_by text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected')),
    disposition text CHECK (disposition IN ('released', 'returned', 'scrapped')),
    notes text,
    image_urls text[],
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by text
);

-- Ensure all columns exist for older table versions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='shipment_reference') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN shipment_reference text;
        RAISE NOTICE 'Added column shipment_reference';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='po_number') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN po_number text;
        RAISE NOTICE 'Added column po_number';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='product_name') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN product_name text;
        RAISE NOTICE 'Added column product_name';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='discrepancy_reason') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN discrepancy_reason text;
        RAISE NOTICE 'Added column discrepancy_reason';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='reported_by') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN reported_by text;
        RAISE NOTICE 'Added column reported_by';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='supplier_name') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN supplier_name text;
        RAISE NOTICE 'Added column supplier_name';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipment_discrepancies' AND column_name='created_at') THEN
        ALTER TABLE public.shipment_discrepancies ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
        RAISE NOTICE 'Added column created_at';
    END IF;
END $$;

-- 2. GRN Quality Checks Table
CREATE TABLE IF NOT EXISTS public.grn_quality_checks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id uuid NOT NULL,
    check_date timestamptz NOT NULL DEFAULT now(),
    inspector_name text NOT NULL,
    passed boolean NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE public.shipment_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_quality_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service-level roles on discrepancies" ON public.shipment_discrepancies;
CREATE POLICY "Allow all for service-level roles on discrepancies" 
ON public.shipment_discrepancies 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service-level roles on quality checks" ON public.grn_quality_checks;
CREATE POLICY "Allow all for service-level roles on quality checks" 
ON public.grn_quality_checks 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Permissions
GRANT ALL ON public.shipment_discrepancies TO anon, authenticated;
GRANT ALL ON public.grn_quality_checks TO anon, authenticated;

-- 5. Resolve Discrepancy Function
CREATE OR REPLACE FUNCTION public.resolve_discrepancy(
    p_discrepancy_id uuid,
    p_disposition text, -- 'released', 'returned', 'scrapped'
    p_resolved_by text DEFAULT 'qc_inspector'
) RETURNS jsonb AS $$
DECLARE
    v_adj record;
    v_product_uuid uuid;
    v_stock_before numeric;
    v_stock_after numeric;
    v_default_bin_id uuid;
BEGIN
    -- 1. Get Discrepancy Info
    SELECT * INTO v_adj FROM public.shipment_discrepancies WHERE id = p_discrepancy_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Discrepancy not found');
    END IF;

    IF v_adj.status = 'resolved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Discrepancy is already resolved');
    END IF;

    -- 2. Update Inventory if Returning or Scrapping
    -- If 'released', we keep the stock that was already added during GRN post.
    -- If 'returned' or 'scrapped', we must REMOVE the stock that was added.
    IF p_disposition IN ('returned', 'scrapped') THEN
        -- Resolve Product UUID
        SELECT product_id INTO v_product_uuid FROM public.products WHERE sku = v_adj.sku LIMIT 1;
        
        -- Get default bin
        SELECT id INTO v_default_bin_id FROM public.bins LIMIT 1;

        -- Get current stock
        SELECT qty_on_hand INTO v_stock_before 
        FROM public.inventory_on_hand 
        WHERE product_id = v_product_uuid AND bin_id = v_default_bin_id;

        IF v_stock_before IS NULL THEN v_stock_before := 0; END IF;

        v_stock_after := v_stock_before - v_adj.received_qty;

        -- Update Stock
        UPDATE public.inventory_on_hand 
        SET qty_on_hand = v_stock_after, updated_at = now()
        WHERE product_id = v_product_uuid AND bin_id = v_default_bin_id;

        -- Record Movement
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
            v_product_uuid,
            v_adj.sku,
            v_adj.product_name,
            upper(p_disposition),
            'OUT',
            v_adj.received_qty,
            v_stock_before,
            v_stock_after,
            v_adj.shipment_reference,
            'Discrepancy ' || p_disposition || ' by ' || p_resolved_by,
            p_resolved_by
        );
    END IF;

    -- 3. Update Discrepancy Record
    UPDATE public.shipment_discrepancies
    SET status = 'resolved',
        disposition = p_disposition,
        resolved_at = now(),
        resolved_by = p_resolved_by
    WHERE id = p_discrepancy_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', p_discrepancy_id,
        'disposition', p_disposition,
        'status', 'resolved'
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.resolve_discrepancy(uuid, text, text) TO anon, authenticated;

-- Trigger schema cache reload
NOTIFY pgrst, 'reload schema';
