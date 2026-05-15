-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This script provisions the stock adjustment workflow in the Fulfillment project
-- to ensure adjustments are reflected in the movement report and stock levels.

-- 1. Stock Adjustments Table
-- Ensure table exists first
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id text NOT NULL,
    sku text NOT NULL,
    product_name text NOT NULL,
    qty_before numeric NOT NULL,
    qty_change numeric NOT NULL,
    qty_after numeric NOT NULL,
    reason text NOT NULL,
    reason_category text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    movement_type text DEFAULT 'ADJUSTMENT',
    requested_by text NOT NULL,
    approved_by text,
    approved_at timestamptz,
    rejection_note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Explicitly add movement_type if it was missing from an existing table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_adjustments' AND column_name='movement_type') THEN
        ALTER TABLE public.stock_adjustments ADD COLUMN movement_type text DEFAULT 'ADJUSTMENT';
    END IF;
END $$;

-- 2. Approve Stock Adjustment Function
-- This function now updates inventory and records movements.
CREATE OR REPLACE FUNCTION public.approve_stock_adjustment(
    p_adjustment_id uuid,
    p_manager_name text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_adj RECORD;
    v_bin_id uuid;
    v_product_uuid uuid;
    v_stock_before numeric;
    v_stock_after numeric;
BEGIN
    -- 1. Get and lock the adjustment record
    SELECT * INTO v_adj
    FROM public.stock_adjustments
    WHERE id = p_adjustment_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjustment not found or not pending');
    END IF;

    -- 2. Resolve Product UUID (since fulfillment uses UUIDs but adjustments might come with SCM integer IDs)
    SELECT product_id INTO v_product_uuid 
    FROM public.products 
    WHERE sku = v_adj.sku 
    LIMIT 1;

    IF v_product_uuid IS NULL THEN
        -- Fallback: try to cast if it looks like a uuid, otherwise this will be null
        BEGIN
            v_product_uuid := v_adj.product_id::uuid;
        EXCEPTION WHEN OTHERS THEN
            v_product_uuid := NULL;
        END;
    END IF;

    -- 3. Find a bin for this product
    SELECT bin_id, qty_on_hand INTO v_bin_id, v_stock_before
    FROM public.inventory_on_hand
    WHERE sku = v_adj.sku
    ORDER BY updated_at DESC
    LIMIT 1;

    -- If no bin exists, try to get the default bin
    IF v_bin_id IS NULL THEN
        SELECT id INTO v_bin_id FROM public.bins LIMIT 1;
        v_stock_before := 0;
    END IF;

    IF v_bin_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No bin found to adjust stock in');
    END IF;

    v_stock_after := v_stock_before + v_adj.qty_change;

    -- 4. Update inventory_on_hand
    IF v_product_uuid IS NOT NULL THEN
        INSERT INTO public.inventory_on_hand (product_id, sku, bin_id, qty_on_hand, updated_at)
        VALUES (v_product_uuid, v_adj.sku, v_bin_id, v_stock_after, now())
        ON CONFLICT (product_id, bin_id) DO UPDATE
        SET qty_on_hand = EXCLUDED.qty_on_hand,
            sku = EXCLUDED.sku,
            updated_at = now();
    END IF;

    -- 5. Record the movement
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
        'STOCK_ADJUSTMENT',
        CASE WHEN v_adj.qty_change > 0 THEN 'IN' ELSE 'OUT' END,
        ABS(v_adj.qty_change),
        v_stock_before,
        v_stock_after,
        'ADJ-' || substring(v_adj.id::text, 1, 8),
        v_adj.reason_category || ': ' || v_adj.reason,
        p_manager_name
    );

    -- 6. Update the adjustment record status
    UPDATE public.stock_adjustments
    SET status = 'approved',
        approved_by = p_manager_name,
        approved_at = now()
    WHERE id = p_adjustment_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', p_adjustment_id,
        'status', 'approved',
        'new_stock', v_stock_after
    );
END;
$$;

-- 3. Reject Stock Adjustment Function
CREATE OR REPLACE FUNCTION public.reject_stock_adjustment(
    p_adjustment_id uuid,
    p_manager_name text,
    p_rejection_note text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.stock_adjustments
    SET status = 'rejected',
        approved_by = p_manager_name,
        approved_at = now(),
        rejection_note = p_rejection_note
    WHERE id = p_adjustment_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adjustment not found or not pending');
    END IF;

    RETURN jsonb_build_object('success', true, 'id', p_adjustment_id, 'status', 'rejected');
END;
$$;

-- 4. Patch inventory_movements to allow NULL product_id if metadata sync is pending
DO $$
BEGIN
    ALTER TABLE public.inventory_movements ALTER COLUMN product_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 5. Permissions and RLS
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service-level roles on adjustments" ON public.stock_adjustments;
CREATE POLICY "Allow all for service-level roles on adjustments" 
ON public.stock_adjustments 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

GRANT ALL ON public.stock_adjustments TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_stock_adjustment(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_stock_adjustment(uuid, text, text) TO anon, authenticated;

-- Trigger schema cache reload
NOTIFY pgrst, 'reload schema';
