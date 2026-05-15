-- ============================================================
-- Function: public.t2_post_landed_costs(p_payload jsonb)
-- Target project: Supply Chain (wbktqkjdsqrvqxxtitsg)
-- 
-- Called from POlist.tsx via supabase.rpc("t2_post_landed_costs", { p_payload: {...} })
-- 
-- Payload shape:
--   {
--     "po_id": "<uuid>",
--     "fees": [
--       { "fee_type": "freight",  "amount": 12000 },
--       { "fee_type": "duties",   "amount": 4500  },
--       { "fee_type": "handling", "amount": 800   }
--     ]
--   }
--
-- Behaviour:
--   1. Validates the PO exists
--   2. Idempotency: if landed_costs_posted_at is already set, raises an exception
--   3. Sums fees by recognised type:
--        "freight"  → freight_cost column
--        "duties"   → duties_paid column
--        anything else → ignored (safe for future fee types)
--   4. Stamps landed_costs_posted_at = now()
--   5. Returns the updated purchase_orders row
-- ============================================================

CREATE OR REPLACE FUNCTION public.t2_post_landed_costs(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_po_id           uuid;
  v_freight_cost    numeric := 0;
  v_duties_paid     numeric := 0;
  v_fee             jsonb;
  v_fee_type        text;
  v_amount          numeric;
  v_result          jsonb;
BEGIN
  -- 1. Extract & validate po_id
  v_po_id := (p_payload->>'po_id')::uuid;

  IF v_po_id IS NULL THEN
    RAISE EXCEPTION 'po_id is required in payload';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.purchase_orders WHERE po_id = v_po_id
  ) THEN
    RAISE EXCEPTION 'Purchase order % not found', v_po_id;
  END IF;

  -- 2. Idempotency guard
  IF EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE po_id = v_po_id AND landed_costs_posted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Landed costs have already been posted for PO %', v_po_id;
  END IF;

  -- 3. Sum fees by type
  FOR v_fee IN SELECT * FROM jsonb_array_elements(p_payload->'fees')
  LOOP
    v_fee_type := lower(trim(v_fee->>'fee_type'));
    v_amount   := coalesce((v_fee->>'amount')::numeric, 0);

    IF v_fee_type = 'freight' THEN
      v_freight_cost := v_freight_cost + v_amount;
    ELSIF v_fee_type IN ('duties', 'duty', 'customs') THEN
      v_duties_paid := v_duties_paid + v_amount;
    END IF;
    -- Other fee types (handling, insurance, etc.) are accepted but not mapped to columns yet
  END LOOP;

  -- 4. Update the PO and stamp the posted timestamp
  UPDATE public.purchase_orders
  SET
    freight_cost           = CASE WHEN v_freight_cost > 0 THEN v_freight_cost ELSE freight_cost END,
    duties_paid            = CASE WHEN v_duties_paid  > 0 THEN v_duties_paid  ELSE duties_paid  END,
    landed_costs_posted_at = now()
  WHERE po_id = v_po_id
  RETURNING to_jsonb(purchase_orders.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to anon and authenticated so the frontend Supabase client can call it
GRANT EXECUTE ON FUNCTION public.t2_post_landed_costs(jsonb) TO anon, authenticated;
