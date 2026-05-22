-- TARGET PROJECT: Quality & Compliance (jbfzhlalkjbtbitvxeog)
-- Copy and run this entire script in the SQL Editor of the Quality & Compliance project.

-- 1. Disable RLS temporarily to clear any stuck state
ALTER TABLE public.shipment_discrepancies DISABLE ROW LEVEL SECURITY;

-- 2. Drop all potential policies that might conflict or cause issues
DROP POLICY IF EXISTS "Allow service full access on shipment_discrepancies" ON public.shipment_discrepancies;
DROP POLICY IF EXISTS "Allow all for service-level roles on discrepancies" ON public.shipment_discrepancies;
DROP POLICY IF EXISTS "Owner full access on shipment_discrepancies" ON public.shipment_discrepancies;
DROP POLICY IF EXISTS "Allow anonymous access to shipment_discrepancies" ON public.shipment_discrepancies;

-- 3. Create a single, clean permissive policy for everyone (including anon and authenticated roles)
CREATE POLICY "Allow service full access on shipment_discrepancies"
    ON public.shipment_discrepancies FOR ALL
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 4. Re-enable Row Level Security
ALTER TABLE public.shipment_discrepancies ENABLE ROW LEVEL SECURITY;

-- 5. Grant explicit SQL permissions to all roles
GRANT ALL ON public.shipment_discrepancies TO anon;
GRANT ALL ON public.shipment_discrepancies TO authenticated;
GRANT ALL ON public.shipment_discrepancies TO service_role;
