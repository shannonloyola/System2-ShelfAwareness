-- 1. Create the custom types for roles
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

-- 2. Create the profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name text,
    role public.app_role DEFAULT 'b2b_customer' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Enable RLS on profiles (so users can read their own profile)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Owners can view all profiles" 
ON public.profiles FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'owner_president'
  )
);

-- 4. Create helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. Helper to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(target_role public.app_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = target_role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
