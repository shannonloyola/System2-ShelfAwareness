-- ==========================================
-- DOMAIN 1: IDENTITY & ACCESS (IAM)
-- Run this in your new "Identity" Supabase Project
-- ==========================================

-- 1. Setup Roles Enum
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

-- 2. Setup Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name text,
    role public.app_role DEFAULT 'b2b_customer' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view their own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

-- 4. Auto-Profile Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'), 
    'b2b_customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Fix Search Path for Auth Service
ALTER ROLE authenticator SET search_path = public, auth;

-- 6. Helper Functions
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;
