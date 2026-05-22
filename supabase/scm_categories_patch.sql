-- Target project: SCM (wbktqkjdsqrvqxxtitsg)
-- This patch ensures all the required product categories are present in the Product Master dropdown.

-- First ensure the parent categories exist
INSERT INTO public.product_categories (name, parent_id)
SELECT seed.name, seed.parent_id
FROM (
  VALUES
    ('Pharma', null::uuid),
    ('Medical Supplies', null::uuid),
    ('Cold Chain', null::uuid)
) AS seed(name, parent_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories existing
  WHERE lower(existing.name) = lower(seed.name) AND existing.parent_id IS NULL
);

-- Then insert the missing subcategories under their respective parents
WITH parent_categories AS (
  SELECT id, lower(name) AS key
  FROM public.product_categories
  WHERE parent_id IS NULL
    AND lower(name) IN ('pharma', 'medical supplies', 'cold chain')
),
seed_subcategories AS (
  -- Under Pharma
  SELECT 'Analgesics'::text AS name, id AS parent_id FROM parent_categories WHERE key = 'pharma'
  UNION ALL SELECT 'Antibiotics'::text, id FROM parent_categories WHERE key = 'pharma'
  UNION ALL SELECT 'Diabetes Care'::text, id FROM parent_categories WHERE key = 'pharma'
  UNION ALL SELECT 'Maintenance Medicines'::text, id FROM parent_categories WHERE key = 'pharma'
  UNION ALL SELECT 'OTC Medications'::text, id FROM parent_categories WHERE key = 'pharma'
  UNION ALL SELECT 'Vitamins & Supplements'::text, id FROM parent_categories WHERE key = 'pharma'
  
  -- Under Medical Supplies
  UNION ALL SELECT 'Baby Care'::text, id FROM parent_categories WHERE key = 'medical supplies'
  UNION ALL SELECT 'Consumables'::text, id FROM parent_categories WHERE key = 'medical supplies'
  UNION ALL SELECT 'Devices'::text, id FROM parent_categories WHERE key = 'medical supplies'
  UNION ALL SELECT 'First Aid'::text, id FROM parent_categories WHERE key = 'medical supplies'
  UNION ALL SELECT 'Health & Wellness'::text, id FROM parent_categories WHERE key = 'medical supplies'
  UNION ALL SELECT 'Personal Care'::text, id FROM parent_categories WHERE key = 'medical supplies'
  
  -- Under Cold Chain
  UNION ALL SELECT 'Refrigerated'::text, id FROM parent_categories WHERE key = 'cold chain'
)
INSERT INTO public.product_categories (name, parent_id)
SELECT seed.name, seed.parent_id
FROM seed_subcategories seed
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_categories existing
  WHERE lower(existing.name) = lower(seed.name) AND existing.parent_id = seed.parent_id
);

-- Trigger schema cache reload for REST API just in case
NOTIFY pgrst, 'reload schema';
