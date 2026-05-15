-- Safe to run on ANY project (Identity, SCM, Fulfillment, Quality, etc.)

-- 0. BOOTSTRAP RBAC TYPES & FUNCTIONS (Required for RLS in all projects)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'owner_president',
            'finance_manager',
            'procurement_manager',
            'logistics_coordinator',
            'warehouse_manager',
            'qc_inspector',
            'sales_processor',
            'delivery_person',
            'b2b_customer',
            'supplier'
        );
    END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  -- Try to get role from JWT metadata (app_metadata.role)
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  
  -- Fallback to profiles table if it exists in this project
  IF v_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
       EXECUTE 'SELECT role::text FROM public.profiles WHERE id = auth.uid()' INTO v_role;
    END IF;
  END IF;

  RETURN COALESCE(v_role, 'b2b_customer');
END;
$$;

DROP FUNCTION IF EXISTS public.get_my_name() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_name()
RETURNS text 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_name text;
BEGIN
  -- Try to get name from JWT user_metadata
  v_name := auth.jwt() -> 'user_metadata' ->> 'full_name';
  
  -- Fallback to profiles table if it exists in this project
  IF v_name IS NULL THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
       EXECUTE 'SELECT full_name FROM public.profiles WHERE id = auth.uid()' INTO v_name;
    END IF;
  END IF;

  RETURN v_name;
END;
$$;



DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. Enable RLS on existing tables (except profiles which has custom logic)
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'profiles') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;

    -- 2. Owner/President Global Policies
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'profiles') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Owner full access on ' || r.tablename || '" ON public.' || quote_ident(r.tablename);
        EXECUTE 'CREATE POLICY "Owner full access on ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || 
                ' FOR ALL USING (public.get_my_role() = ''owner_president'');';
    END LOOP;
END $$;

-- 3. SPECIFIC POLICIES WRAPPED IN CHECKS

-- PURCHASE ORDERS
-- The procurement-service calls Supabase REST using the anon key (no user session).
-- All four operations (SELECT, INSERT, UPDATE, DELETE) must be explicitly allowed for anon.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_orders') THEN
        DROP POLICY IF EXISTS "Procurement Manager full access on purchase_orders" ON public.purchase_orders;
        CREATE POLICY "Procurement Manager full access on purchase_orders" ON public.purchase_orders FOR ALL USING (public.get_my_role() = 'procurement_manager');

        -- Single unrestricted policy for anon/service calls (replaces split SELECT/INSERT)
        DROP POLICY IF EXISTS "Allow service full access on purchase_orders" ON public.purchase_orders;
        DROP POLICY IF EXISTS "Allow anonymous insert for procurement service" ON public.purchase_orders;
        DROP POLICY IF EXISTS "Allow anonymous select for procurement service" ON public.purchase_orders;
        DROP POLICY IF EXISTS "Allow anonymous update for procurement service" ON public.purchase_orders;
        DROP POLICY IF EXISTS "Allow anonymous delete for procurement service" ON public.purchase_orders;
        CREATE POLICY "Allow service full access on purchase_orders"
            ON public.purchase_orders FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);

        DROP POLICY IF EXISTS "Suppliers view own purchase orders" ON public.purchase_orders;
        CREATE POLICY "Suppliers view own purchase orders" ON public.purchase_orders FOR SELECT USING (
          public.get_my_role() = 'supplier' AND 
          supplier_name = public.get_my_name()
        );

        DROP POLICY IF EXISTS "Finance view and update purchase orders" ON public.purchase_orders;
        CREATE POLICY "Finance view and update purchase orders" ON public.purchase_orders FOR SELECT USING (public.get_my_role() = 'finance_manager');
    END IF;
END $$;

-- PURCHASE ORDER ITEMS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_order_items') THEN
        DROP POLICY IF EXISTS "Allow anonymous access to purchase_order_items" ON public.purchase_order_items;
        CREATE POLICY "Allow anonymous access to purchase_order_items"
            ON public.purchase_order_items FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- PO STATUS HISTORY
-- Required for ETA updates, document uploads, and status tracking via the procurement service.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'po_status_history') THEN
        DROP POLICY IF EXISTS "Allow service full access on po_status_history" ON public.po_status_history;
        CREATE POLICY "Allow service full access on po_status_history"
            ON public.po_status_history FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- SUPPLIERS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'suppliers') THEN
        DROP POLICY IF EXISTS "Procurement Manager full access on suppliers" ON public.suppliers;
        CREATE POLICY "Procurement Manager full access on suppliers" ON public.suppliers FOR ALL USING (public.get_my_role() = 'procurement_manager');
    END IF;
END $$;


-- INVENTORY & MOVEMENTS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_balances') THEN
        DROP POLICY IF EXISTS "Warehouse Manager full access on inventory" ON public.inventory_balances;
        CREATE POLICY "Warehouse Manager full access on inventory" ON public.inventory_balances FOR ALL USING (public.get_my_role() = 'warehouse_manager');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_movements') THEN
        DROP POLICY IF EXISTS "Warehouse Manager full access on movements" ON public.inventory_movements;
        CREATE POLICY "Warehouse Manager full access on movements" ON public.inventory_movements FOR ALL USING (public.get_my_role() = 'warehouse_manager');

        DROP POLICY IF EXISTS "Allow service management for movements" ON public.inventory_movements;
        CREATE POLICY "Allow service management for movements" ON public.inventory_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- QUALITY CHECKS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'grn_quality_checks') THEN
        DROP POLICY IF EXISTS "QC Inspector full access on quality checks" ON public.grn_quality_checks;
        CREATE POLICY "QC Inspector full access on quality checks" ON public.grn_quality_checks FOR ALL USING (public.get_my_role() = 'qc_inspector');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'qc_inspections') THEN
        DROP POLICY IF EXISTS "QC Inspector full access on qc inspections" ON public.qc_inspections;
        CREATE POLICY "QC Inspector full access on qc inspections" ON public.qc_inspections FOR ALL USING (public.get_my_role() = 'qc_inspector');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'goods_receipts') THEN
        DROP POLICY IF EXISTS "QC Inspector view goods receipts" ON public.goods_receipts;
        CREATE POLICY "QC Inspector view goods receipts" ON public.goods_receipts FOR SELECT USING (public.get_my_role() = 'qc_inspector');
    END IF;
END $$;

-- RETAIL ORDERS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'retail_orders') THEN
        DROP POLICY IF EXISTS "Sales Processor full access on retail orders" ON public.retail_orders;
        CREATE POLICY "Sales Processor full access on retail orders" ON public.retail_orders FOR ALL USING (public.get_my_role() = 'sales_processor');

        DROP POLICY IF EXISTS "B2B Customer create retail orders" ON public.retail_orders;
        CREATE POLICY "B2B Customer create retail orders" ON public.retail_orders FOR INSERT WITH CHECK (public.get_my_role() = 'b2b_customer');

        DROP POLICY IF EXISTS "B2B Customer view own orders" ON public.retail_orders;
        CREATE POLICY "B2B Customer view own orders" ON public.retail_orders FOR SELECT USING (
          public.get_my_role() = 'b2b_customer' AND 
          retailer_name = public.get_my_name()
        );

        DROP POLICY IF EXISTS "Delivery Person update order status" ON public.retail_orders;
        CREATE POLICY "Delivery Person update order status" ON public.retail_orders FOR UPDATE USING (public.get_my_role() = 'delivery_person') WITH CHECK (status IN ('dispatched', 'fulfilled'));
    END IF;
END $$;

-- BUDGETS & PAYMENTS
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        DROP POLICY IF EXISTS "Finance Manager full access on payments" ON public.payments;
        CREATE POLICY "Finance Manager full access on payments" ON public.payments FOR ALL USING (public.get_my_role() = 'finance_manager');
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_budgets') THEN
        DROP POLICY IF EXISTS "Finance Manager full access on budgets" ON public.monthly_budgets;
        CREATE POLICY "Finance Manager full access on budgets" ON public.monthly_budgets FOR ALL USING (public.get_my_role() = 'finance_manager');
    END IF;
END $$;

-- PRODUCTS & CATALOG (Unblocked for Services)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
        DROP POLICY IF EXISTS "Allow service management for products" ON public.products;
        CREATE POLICY "Allow service management for products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
        
        DROP POLICY IF EXISTS "Anyone authenticated can view products" ON public.products;
        DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
        CREATE POLICY "Anyone can view products" ON public.products FOR SELECT TO anon, authenticated USING (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_categories') THEN
        DROP POLICY IF EXISTS "Allow service management for categories" ON public.product_categories;
        CREATE POLICY "Allow service management for categories" ON public.product_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_pricing') THEN
        DROP POLICY IF EXISTS "Allow service management for pricing" ON public.product_pricing;
        CREATE POLICY "Allow service management for pricing" ON public.product_pricing FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory_on_hand') THEN
        DROP POLICY IF EXISTS "Allow service management for inventory_sync" ON public.inventory_on_hand;
        CREATE POLICY "Allow service management for inventory_sync" ON public.inventory_on_hand FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_adjustments') THEN
        DROP POLICY IF EXISTS "Allow service full access on stock_adjustments" ON public.stock_adjustments;
        CREATE POLICY "Allow service full access on stock_adjustments"
            ON public.stock_adjustments FOR ALL
            TO anon, authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
