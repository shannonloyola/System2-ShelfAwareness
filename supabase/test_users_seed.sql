-- Enable pgcrypto for password hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_finance_id uuid := gen_random_uuid();
  v_procurement_id uuid := gen_random_uuid();
  v_logistics_id uuid := gen_random_uuid();
  v_warehouse_id uuid := gen_random_uuid();
  v_qc_id uuid := gen_random_uuid();
  v_sales_id uuid := gen_random_uuid();
  v_delivery_id uuid := gen_random_uuid();
  v_b2b_id uuid := gen_random_uuid();
  v_supplier_id uuid := gen_random_uuid();
  
  -- Default password is 'password123'
  v_password text := crypt('password123', gen_salt('bf'));
BEGIN
  -- ==========================================
  -- 1. INSERT INTO AUTH.USERS
  -- ==========================================
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
  VALUES
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"owner_president"}', '{}', false),
    (v_finance_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'finance@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"finance_manager"}', '{}', false),
    (v_procurement_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'procurement@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"procurement_manager"}', '{}', false),
    (v_logistics_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'logistics@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"logistics_coordinator"}', '{}', false),
    (v_warehouse_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'warehouse@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"warehouse_manager"}', '{}', false),
    (v_qc_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qc@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"qc_inspector"}', '{}', false),
    (v_sales_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"sales_processor"}', '{}', false),
    (v_delivery_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"delivery_person"}', '{}', false),
    (v_b2b_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b2b@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"b2b_customer"}', '{}', false),
    (v_supplier_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'supplier@test.com', v_password, now(), now(), now(), '{"provider":"email","providers":["email"],"role":"supplier"}', '{}', false);

  -- ==========================================
  -- 2. INSERT INTO PUBLIC.PROFILES (RBAC)
  -- ==========================================
  INSERT INTO public.profiles (id, full_name, role)
  VALUES
    (v_owner_id, 'Test Owner', 'owner_president'),
    (v_finance_id, 'Test Finance', 'finance_manager'),
    (v_procurement_id, 'Test Procurement', 'procurement_manager'),
    (v_logistics_id, 'Test Logistics', 'logistics_coordinator'),
    (v_warehouse_id, 'Test Warehouse', 'warehouse_manager'),
    (v_qc_id, 'Test QC', 'qc_inspector'),
    (v_sales_id, 'Test Sales', 'sales_processor'),
    (v_delivery_id, 'Test Delivery', 'delivery_person'),
    (v_b2b_id, 'Test B2B Customer', 'b2b_customer'),
    (v_supplier_id, 'Test Supplier (Japan)', 'supplier');

END $$;
