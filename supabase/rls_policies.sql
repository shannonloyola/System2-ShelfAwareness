-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- ==========================================
-- 1. GLOBAL POLICIES (OWNER ACCESS)
-- ==========================================
-- Owner/President has full access to all tables
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'CREATE POLICY "Owner full access on ' || r.tablename || '" ON public.' || quote_ident(r.tablename) || 
                ' FOR ALL USING (public.get_my_role() = ''owner_president'');';
    END LOOP;
END $$;

-- ==========================================
-- 2. PROCUREMENT POLICIES
-- ==========================================
-- Procurement Manager: Full access to POs and Suppliers
CREATE POLICY "Procurement Manager full access on purchase_orders" 
ON public.purchase_orders FOR ALL 
USING (public.get_my_role() = 'procurement_manager');

CREATE POLICY "Procurement Manager full access on suppliers" 
ON public.suppliers FOR ALL 
USING (public.get_my_role() = 'procurement_manager');

-- Suppliers: View only their own POs
CREATE POLICY "Suppliers view own purchase orders" 
ON public.purchase_orders FOR SELECT 
USING (
  public.get_my_role() = 'supplier' AND 
  supplier_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
);

-- Finance: View and Update (for payment status)
CREATE POLICY "Finance view and update purchase orders" 
ON public.purchase_orders FOR SELECT 
USING (public.get_my_role() = 'finance_manager');

-- ==========================================
-- 3. INVENTORY & WAREHOUSE POLICIES
-- ==========================================
-- Warehouse Manager: Full access to stock and movements
CREATE POLICY "Warehouse Manager full access on inventory" 
ON public.inventory_balances FOR ALL 
USING (public.get_my_role() = 'warehouse_manager');

CREATE POLICY "Warehouse Manager full access on movements" 
ON public.inventory_movements FOR ALL 
USING (public.get_my_role() = 'warehouse_manager');

-- QC Inspector: Quality Checks
CREATE POLICY "QC Inspector full access on quality checks" 
ON public.grn_quality_checks FOR ALL 
USING (public.get_my_role() = 'qc_inspector');

CREATE POLICY "QC Inspector view goods receipts" 
ON public.goods_receipts FOR SELECT 
USING (public.get_my_role() = 'qc_inspector');

-- ==========================================
-- 4. SALES & RETAIL ORDERS
-- ==========================================
-- Sales Processor: Full access to retail orders
CREATE POLICY "Sales Processor full access on retail orders" 
ON public.retail_orders FOR ALL 
USING (public.get_my_role() = 'sales_processor');

-- B2B Customer: Create and View own orders
CREATE POLICY "B2B Customer create retail orders" 
ON public.retail_orders FOR INSERT 
WITH CHECK (public.get_my_role() = 'b2b_customer');

CREATE POLICY "B2B Customer view own orders" 
ON public.retail_orders FOR SELECT 
USING (
  public.get_my_role() = 'b2b_customer' AND 
  retailer_name = (SELECT full_name FROM public.profiles WHERE id = auth.uid())
);

-- Delivery Person: View and Update status
CREATE POLICY "Delivery Person view schedules" 
ON public.delivery_schedules FOR SELECT 
USING (public.get_my_role() = 'delivery_person');

CREATE POLICY "Delivery Person update order status" 
ON public.retail_orders FOR UPDATE 
USING (public.get_my_role() = 'delivery_person')
WITH CHECK (status IN ('dispatched', 'fulfilled'));

-- ==========================================
-- 5. FINANCE & BUDGETS
-- ==========================================
CREATE POLICY "Finance Manager full access on payments" 
ON public.payments FOR ALL 
USING (public.get_my_role() = 'finance_manager');

CREATE POLICY "Finance Manager full access on budgets" 
ON public.monthly_budgets FOR ALL 
USING (public.get_my_role() = 'finance_manager');

-- ==========================================
-- 6. PRODUCT CATALOG (READ ONLY FOR ALL)
-- ==========================================
CREATE POLICY "Anyone authenticated can view products" 
ON public.products FOR SELECT 
TO authenticated 
USING (true);
