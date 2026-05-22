-- Target project: SCM (wbktqkjdsqrvqxxtitsg)
-- This script flattens the category hierarchy so all the requested categories appear in the main dropdown.

-- 1. First, ensure all 13 categories from the image exist (in case they don't).
INSERT INTO public.product_categories (name, parent_id)
SELECT seed.name, NULL
FROM (
  VALUES
    ('Analgesics'),
    ('Antibiotics'),
    ('Baby Care'),
    ('Consumables'),
    ('Devices'),
    ('Diabetes Care'),
    ('First Aid'),
    ('Health & Wellness'),
    ('Maintenance Medicines'),
    ('OTC Medications'),
    ('Personal Care'),
    ('Refrigerated'),
    ('Vitamins & Supplements')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories existing
  WHERE lower(existing.name) = lower(seed.name)
);

-- 2. Make them all top-level categories by setting parent_id to NULL
UPDATE public.product_categories
SET parent_id = NULL
WHERE lower(name) IN (
    'analgesics', 'antibiotics', 'baby care', 'consumables', 'devices',
    'diabetes care', 'first aid', 'health & wellness', 'maintenance medicines',
    'otc medications', 'personal care', 'refrigerated', 'vitamins & supplements'
);

-- 3. (Optional) Remove the old parent categories if they aren't used by any products
DELETE FROM public.product_categories
WHERE lower(name) IN ('pharma', 'medical supplies', 'cold chain')
  AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.category_id = public.product_categories.id
  );

-- Trigger schema cache reload for REST API just in case
NOTIFY pgrst, 'reload schema';
