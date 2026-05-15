-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This script ensures a single, clean version of the transfer_stock RPC exists.

-- 1. DROP ALL PREVIOUS VERSIONS to prevent function overloading/shadowing
DROP FUNCTION IF EXISTS public.transfer_stock(uuid, uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.transfer_stock(uuid, uuid, uuid, numeric, text);

-- 2. CREATE THE DEFINITIVE VERSION
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_product_id uuid,
    p_from_bin_id uuid,
    p_to_bin_id uuid,
    p_qty numeric,
    p_created_by text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_source_qty numeric;
    v_dest_qty numeric;
    v_product_sku text;
    v_product_name text;
    v_inserted_id uuid;
BEGIN
    -- 1. Validate quantity
    IF p_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
    END IF;

    -- 2. Check source stock and get SKU
    SELECT qty_on_hand, sku INTO v_source_qty, v_product_sku
    FROM public.inventory_on_hand
    WHERE product_id = p_product_id AND bin_id = p_from_bin_id;

    -- If not found, assume 0 stock
    IF v_source_qty IS NULL THEN
        v_source_qty := 0;
        -- Try to get SKU from another bin for this product if possible
        SELECT sku INTO v_product_sku FROM public.inventory_on_hand WHERE product_id = p_product_id LIMIT 1;
        -- If still no SKU, get it from the products table
        IF v_product_sku IS NULL THEN
            SELECT sku INTO v_product_sku FROM public.products WHERE product_id = p_product_id;
        END IF;
    END IF;

    IF v_source_qty < p_qty THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock in source bin. Available: ' || COALESCE(v_source_qty, 0));
    END IF;

    -- 3. Get product name for movement log
    SELECT product_name INTO v_product_name
    FROM public.products
    WHERE product_id = p_product_id;

    -- 4. Perform Transfer
    -- Decrease source
    UPDATE public.inventory_on_hand
    SET qty_on_hand = qty_on_hand - p_qty,
        updated_at = now()
    WHERE product_id = p_product_id AND bin_id = p_from_bin_id;

    -- Increase destination (upsert)
    INSERT INTO public.inventory_on_hand (product_id, bin_id, qty_on_hand, sku, updated_at)
    VALUES (p_product_id, p_to_bin_id, p_qty, v_product_sku, now())
    ON CONFLICT (product_id, bin_id) DO UPDATE
    SET qty_on_hand = public.inventory_on_hand.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_at = now();

    -- 5. Log Movements
    -- Source movement (OUT)
    INSERT INTO public.inventory_movements (
        product_id, sku, product_name, movement_type, direction, qty, 
        stock_before, stock_after, reference, notes, created_by
    ) VALUES (
        p_product_id, v_product_sku, v_product_name, 'STOCK TRANSFER', 'OUT', p_qty,
        v_source_qty, v_source_qty - p_qty, 'TRANSFER', 'Transfer to ' || p_to_bin_id::text, p_created_by
    ) RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RAISE EXCEPTION 'CRITICAL: Failed to insert movement record for OUT direction';
    END IF;

    -- Destination movement (IN)
    SELECT qty_on_hand INTO v_dest_qty
    FROM public.inventory_on_hand
    WHERE product_id = p_product_id AND bin_id = p_to_bin_id;

    INSERT INTO public.inventory_movements (
        product_id, sku, product_name, movement_type, direction, qty, 
        stock_before, stock_after, reference, notes, created_by
    ) VALUES (
        p_product_id, v_product_sku, v_product_name, 'STOCK TRANSFER', 'IN', p_qty,
        v_dest_qty - p_qty, v_dest_qty, 'TRANSFER', 'Transfer from ' || p_from_bin_id::text, p_created_by
    ) RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NULL THEN
        RAISE EXCEPTION 'CRITICAL: Failed to insert movement record for IN direction';
    END IF;

    -- Final verification check
    SELECT count(*) INTO v_dest_qty
    FROM public.inventory_movements
    WHERE product_id = p_product_id AND movement_type = 'STOCK TRANSFER';

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'from_bin_id', p_from_bin_id,
        'to_bin_id', p_to_bin_id,
        'qty', p_qty,
        'log_id', v_inserted_id,
        'total_logs_for_product', v_dest_qty
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO anon, authenticated;

-- Reload schema to ensure PostgREST sees the new function
NOTIFY pgrst, 'reload schema';
