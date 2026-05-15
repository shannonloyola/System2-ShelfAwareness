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

CREATE OR REPLACE FUNCTION public.is_owner_president(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = check_user_id
      AND role = 'owner_president'
  );
$$;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Owners can view all profiles" ON public.profiles;
CREATE POLICY "Owners can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_owner_president());

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_metadata(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_role text;
  target_full_name text;
BEGIN
  SELECT role::text, full_name
  INTO target_role, target_full_name
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RETURN;
  END IF;

  UPDATE auth.users
  SET 
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(target_role),
      true
    ),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{full_name}',
      to_jsonb(target_full_name),
      true
    )
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_metadata_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  PERFORM public.sync_profile_role_to_auth_metadata(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_role_to_auth_metadata_on_profiles ON public.profiles;
CREATE TRIGGER sync_profile_role_to_auth_metadata_on_profiles
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_auth_metadata_trigger();

DO $$
DECLARE
  profile_record record;
BEGIN
  FOR profile_record IN
    SELECT id
    FROM public.profiles
  LOOP
    PERFORM public.sync_profile_role_to_auth_metadata(profile_record.id);
  END LOOP;
END $$;

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
