-- Demo seed: inventory valuation snapshot history
-- Run this in the Fulfillment / Distribution Supabase project: dkqvbyewfyzfmisyisgs
--
-- Intent:
-- - Keep the real captured snapshot for 2026-05-20 intact.
-- - Backfill the prior 6 days with plausible daily totals aligned to the
--   fulfillment demo transactions already seeded in this repo.
--
-- Alignment to seeded fulfillment events:
-- - 2026-05-14 to 2026-05-17 stay flat because there are no seeded value-changing
--   inventory events in that window.
-- - 2026-05-18 drops by PHP 5,919 because the fulfillment seed records:
--     * PARA-500-TAB cycle count correction: -140 units x PHP 2.85 = -PHP 399
--     * INS-GLAR-100-PEN QC hold: -4 units x PHP 1380.00 = -PHP 5,520
--   Total reduction = PHP 5,919
-- - 2026-05-19 remains flat because the seeded THERM-DIGI transfer is internal
--   and should not change total inventory valuation.
-- - 2026-05-20 is expected to be the real snapshot captured by the live endpoint.

begin;

insert into public.inventory_valuation_snapshots (
  snapshot_date,
  total_inventory_value_php,
  category_values,
  source,
  notes,
  generated_at
)
values
  (
    '2026-05-14'::date,
    135934.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":8151.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":30360.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'Flat valuation before May 18 count correction and QC quarantine events.',
    '2026-05-14 18:00+08'::timestamptz
  ),
  (
    '2026-05-15'::date,
    135934.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":8151.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":30360.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'No seeded value-changing movement on this date; valuation remains stable.',
    '2026-05-15 18:00+08'::timestamptz
  ),
  (
    '2026-05-16'::date,
    135934.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":8151.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":30360.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'No seeded value-changing movement on this date; valuation remains stable.',
    '2026-05-16 18:00+08'::timestamptz
  ),
  (
    '2026-05-17'::date,
    135934.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":8151.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":30360.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'Valuation held ahead of the May 18 cycle count and QC hold adjustments.',
    '2026-05-17 18:00+08'::timestamptz
  ),
  (
    '2026-05-18'::date,
    130015.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":7752.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":24840.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'Adjusted down by cycle count correction and insulin QC quarantine hold.',
    '2026-05-18 18:00+08'::timestamptz
  ),
  (
    '2026-05-19'::date,
    130015.00,
    '[
      {"category":"Antibiotics","total_value_php":11985.00},
      {"category":"Analgesics","total_value_php":7752.00},
      {"category":"Maintenance Medicines","total_value_php":931.00},
      {"category":"Diabetes Care","total_value_php":4898.00},
      {"category":"Cold Chain","total_value_php":24840.00},
      {"category":"Consumables","total_value_php":70125.00},
      {"category":"Devices","total_value_php":9484.00}
    ]'::jsonb,
    'demo-history-seed',
    'Internal transfer only; total inventory valuation remains unchanged.',
    '2026-05-19 18:00+08'::timestamptz
  )
on conflict (snapshot_date) do update set
  total_inventory_value_php = excluded.total_inventory_value_php,
  category_values = excluded.category_values,
  source = excluded.source,
  notes = excluded.notes,
  generated_at = excluded.generated_at;

commit;
