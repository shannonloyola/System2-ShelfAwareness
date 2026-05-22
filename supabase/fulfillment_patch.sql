-- Target project: Fulfillment (dkqvbyewfyzfmisyisgs)
-- This patch ensures all required columns exist in the distribution tables.

-- 0. Ensure set_priority_rank function exists
CREATE OR REPLACE FUNCTION public.set_priority_rank()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_rank := CASE
    WHEN NEW.priority_level = 'Urgent' THEN 1
    WHEN NEW.priority_level = 'High' THEN 2
    ELSE 3
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Patch retail_orders
DO $$ 
BEGIN 
    -- Add branch_suffix if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='branch_suffix') THEN
        ALTER TABLE public.retail_orders ADD COLUMN branch_suffix text;
    END IF;

    -- Add notes if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='notes') THEN
        ALTER TABLE public.retail_orders ADD COLUMN notes text;
    END IF;

    -- Add due_date if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='due_date') THEN
        ALTER TABLE public.retail_orders ADD COLUMN due_date date;
    END IF;

    -- Add payment_terms if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='payment_terms') THEN
        ALTER TABLE public.retail_orders ADD COLUMN payment_terms text;
    END IF;

    -- Add total_amount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='total_amount') THEN
        ALTER TABLE public.retail_orders ADD COLUMN total_amount numeric NOT NULL DEFAULT 0;
    END IF;

    -- Add priority_rank if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='priority_rank') THEN
        ALTER TABLE public.retail_orders ADD COLUMN priority_rank integer DEFAULT 3;
    END IF;

    -- Add priority_level if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_orders' AND column_name='priority_level') THEN
        ALTER TABLE public.retail_orders ADD COLUMN priority_level text DEFAULT 'Normal' CHECK (priority_level IN ('Normal', 'High', 'Urgent'));
    END IF;

    -- Ensure priority_rank trigger exists
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_retail_orders_priority_rank') THEN
        CREATE TRIGGER trg_retail_orders_priority_rank
        BEFORE INSERT OR UPDATE OF priority_level ON public.retail_orders
        FOR EACH ROW EXECUTE FUNCTION public.set_priority_rank();
    END IF;
END $$;

-- 2. Patch retail_order_lines
DO $$
BEGIN
    -- Add qty_fulfilled if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_order_lines' AND column_name='qty_fulfilled') THEN
        ALTER TABLE public.retail_order_lines ADD COLUMN qty_fulfilled integer DEFAULT 0;
    END IF;

    -- Add qty_backordered if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_order_lines' AND column_name='qty_backordered') THEN
        ALTER TABLE public.retail_order_lines ADD COLUMN qty_backordered integer DEFAULT 0;
    END IF;

    -- Add unit_price if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='retail_order_lines' AND column_name='unit_price') THEN
        ALTER TABLE public.retail_order_lines ADD COLUMN unit_price numeric DEFAULT 0;
    END IF;
END $$;

-- 3. Patch inventory_on_hand
DO $$
BEGIN
    -- Add sku if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_on_hand' AND column_name='sku') THEN
        ALTER TABLE public.inventory_on_hand ADD COLUMN sku text;
    END IF;
END $$;

-- 4. The Order Fulfillment RPC
CREATE OR REPLACE FUNCTION public.fulfill_retail_order(p_order_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_line RECORD;
    v_bin RECORD;
    v_qty_needed integer;
    v_qty_taken integer;
    v_total_fulfilled integer := 0;
    v_total_backordered integer := 0;
    v_stock_before numeric;
    v_stock_after numeric;
    v_order_no text;
    v_retailer_name text;
BEGIN
    -- Get order info
    SELECT order_no, retailer_name INTO v_order_no, v_retailer_name
    FROM public.retail_orders WHERE order_uuid = p_order_uuid;

    FOR v_line IN (SELECT * FROM public.retail_order_lines WHERE order_uuid = p_order_uuid) LOOP
        v_qty_needed := v_line.qty;
        v_qty_taken := 0;

        -- Try to fulfill from available bins
        FOR v_bin IN (
            SELECT bin_id, qty_on_hand 
            FROM public.inventory_on_hand 
            WHERE sku = v_line.sku AND qty_on_hand > 0 
        ) LOOP
            IF v_qty_needed <= 0 THEN EXIT; END IF;

            v_stock_before := v_bin.qty_on_hand;
            
            IF v_bin.qty_on_hand >= v_qty_needed THEN
                v_qty_taken := v_qty_taken + v_qty_needed;
                v_stock_after := v_bin.qty_on_hand - v_qty_needed;
                v_qty_needed := 0;
            ELSE
                v_qty_taken := v_qty_taken + v_bin.qty_on_hand;
                v_qty_needed := v_qty_needed - v_bin.qty_on_hand;
                v_stock_after := 0;
            END IF;

            -- Update bin stock
            UPDATE public.inventory_on_hand 
            SET qty_on_hand = v_stock_after, updated_at = now()
            WHERE bin_id = v_bin.bin_id AND sku = v_line.sku;

            -- Insert movement
            INSERT INTO public.inventory_movements (
                sku, direction, qty, stock_before, stock_after, movement_type, reference, notes, created_by
            ) VALUES (
                v_line.sku, 'OUT', (v_stock_before - v_stock_after), v_stock_before, v_stock_after, 
                'DISPATCH', v_order_no, 'Fulfilled for ' || v_retailer_name, 'system'
            );
        END LOOP;

        -- Update line totals
        UPDATE public.retail_order_lines 
        SET qty_fulfilled = v_qty_taken, 
            qty_backordered = v_qty_needed
        WHERE line_uuid = v_line.line_uuid;

        v_total_fulfilled := v_total_fulfilled + v_qty_taken;
        v_total_backordered := v_total_backordered + v_qty_needed;

        -- Create backorder if needed
        IF v_qty_needed > 0 THEN
            INSERT INTO public.backorders (
                sku, qty_needed, qty_backordered, order_uuid, order_no, retailer_name, status
            ) VALUES (
                v_line.sku, v_line.qty, v_qty_needed, p_order_uuid, v_order_no, v_retailer_name, 'pending'
            );
        END IF;
    END LOOP;

    -- Update order status if partially or fully fulfilled
    IF v_total_backordered > 0 THEN
        UPDATE public.retail_orders SET status = 'payment_pending' WHERE order_uuid = p_order_uuid;
    ELSE
        UPDATE public.retail_orders SET status = 'approved' WHERE order_uuid = p_order_uuid;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'total_fulfilled', v_total_fulfilled,
        'total_backordered', v_total_backordered
    );
END;
$$;

-- Explicitly trigger schema cache reload for REST API
NOTIFY pgrst, 'reload schema';
