-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)

-- Create a robust stock transfer function
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
BEGIN
    -- 1. Validate quantity
    IF p_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
    END IF;

    -- 2. Check source stock
    SELECT qty_on_hand, sku INTO v_source_qty, v_product_sku
    FROM public.inventory_on_hand
    WHERE product_id = p_product_id AND bin_id = p_from_bin_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source bin not found for this product');
    END IF;

    IF v_source_qty < p_qty THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock in source bin');
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
        p_product_id, v_product_sku, v_product_name, 'BIN_TRANSFER', 'OUT', p_qty,
        v_source_qty, v_source_qty - p_qty, 'TRANSFER', 'Transfer to ' || p_to_bin_id::text, p_created_by
    );

    -- Destination movement (IN)
    SELECT qty_on_hand INTO v_dest_qty
    FROM public.inventory_on_hand
    WHERE product_id = p_product_id AND bin_id = p_to_bin_id;

    INSERT INTO public.inventory_movements (
        product_id, sku, product_name, movement_type, direction, qty, 
        stock_before, stock_after, reference, notes, created_by
    ) VALUES (
        p_product_id, v_product_sku, v_product_name, 'BIN_TRANSFER', 'IN', p_qty,
        v_dest_qty - p_qty, v_dest_qty, 'TRANSFER', 'Transfer from ' || p_from_bin_id::text, p_created_by
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'from_bin_id', p_from_bin_id,
        'to_bin_id', p_to_bin_id,
        'qty', p_qty
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO anon, authenticated;
