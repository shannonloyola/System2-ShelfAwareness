-- Seed pack: 500-row Quality dataset
-- Project: jbfzhlalkjbtbitvxeog
-- Run in Supabase SQL Editor for the Quality project.

begin;

create extension if not exists pgcrypto;

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.shipment_discrepancies (
  id,
  grn_reference,
  shipment_reference,
  product_sku,
  product_name,
  batch_number,
  system_count,
  physical_count,
  discrepancy_units,
  reason_code,
  status,
  reported_by,
  reported_at,
  reviewed_by,
  reviewed_at,
  review_notes,
  created_at,
  updated_at,
  severity,
  evidence_urls,
  supplier_name,
  disposition_action,
  disposition
)
select
  ('a0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format('GRN-FF-%s', lpad(gs::text, 4, '0')),
  format('TRK-FF-%s', lpad(gs::text, 4, '0')),
  format('FUL-SKU-%s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  format('Quality Product %s', lpad((((gs - 1) % 500) + 1)::text, 4, '0')),
  format('BATCH-%s', lpad(gs::text, 5, '0')),
  40 + (gs % 180),
  (40 + (gs % 180)) - case when gs % 3 = 0 then 1 + (gs % 4) when gs % 5 = 0 then 5 + (gs % 9) else 2 end,
  abs((40 + (gs % 180)) - ((40 + (gs % 180)) - case when gs % 3 = 0 then 1 + (gs % 4) when gs % 5 = 0 then 5 + (gs % 9) else 2 end)),
  case
    when gs % 7 = 0 then 'TEMP_EXCURSION'
    when gs % 5 = 0 then 'DAMAGED_PACK'
    when gs % 4 = 0 then 'COUNT_MISMATCH'
    when gs % 3 = 0 then 'LABEL_ERROR'
    else 'SHORT_SHIP'
  end,
  case when gs % 9 = 0 then 'approved' when gs % 11 = 0 then 'rejected' else 'pending' end,
  format('qc-user-%s', ((gs - 1) % 20) + 1),
  now() - make_interval(days => (gs % 120), hours => (gs % 12)),
  case when gs % 9 = 0 or gs % 11 = 0 then format('reviewer-%s', ((gs - 1) % 8) + 1) else null end,
  case when gs % 9 = 0 or gs % 11 = 0 then now() - make_interval(days => (gs % 20)) else null end,
  case
    when gs % 11 = 0 then 'Variance rejected after recount.'
    when gs % 9 = 0 then 'Approved with disposition recorded.'
    else 'Pending QA investigation.'
  end,
  now() - make_interval(days => (gs % 120), hours => (gs % 12)),
  now() - make_interval(days => (gs % 30)),
  case
    when gs % 13 = 0 then 'Critical'
    when gs % 5 = 0 then 'Major'
    else 'Minor'
  end,
  jsonb_build_array(format('https://sample.local/evidence/%s.jpg', lpad(gs::text, 4, '0'))),
  format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((((gs - 1) % 500)) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((((gs - 1) % 500)) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((((gs - 1) % 500)) / 100) % 5) + 1]
  ),
  case
    when gs % 13 = 0 then 'Quarantine'
    when gs % 11 = 0 then 'Return to Supplier'
    when gs % 7 = 0 then 'Write Off'
    when gs % 5 = 0 then 'Re-count'
    else 'Accept Variance'
  end,
  case
    when gs % 9 = 0 then 'released'
    when gs % 11 = 0 then 'returned'
    when gs % 13 = 0 then 'scrapped'
    else null
  end
from src
where not exists (
  select 1
  from public.shipment_discrepancies sd
  where sd.id = ('a0000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.risk_assessments (
  id,
  supplier_name,
  audit_date,
  compliance_status,
  findings,
  assessor_name,
  risk_notes,
  risk_level,
  created_at,
  updated_at
)
select
  ('b0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  format(
    '%s %s %s',
    (array['HealthBridge','NorthStar','MediCore','Pacific','Summit','PrimeCare','Vertex','BlueLine','WellSpring','SteriLab'])[((((gs - 1) % 500)) % 10) + 1],
    (array['Pharma','Biocare','Rx','Meditech','Wellness','Clinical','Lifesciences','Diagnostics','Generics','ColdChain'])[(((((gs - 1) % 500)) / 10) % 10) + 1],
    (array['Supply','Logistics','Laboratories','Healthcare','Solutions','Distribution','Trading','International','Resources','Corporation'])[(((((gs - 1) % 500)) / 100) % 5) + 1]
  ),
  current_date - (gs % 720),
  case when gs % 11 = 0 then 'Non-Compliant' when gs % 5 = 0 then 'Under Review' else 'Compliant' end,
  format('Assessment %s covers GMP, storage, document, and CAPA observations.', lpad(gs::text, 4, '0')),
  format('Assessor %s', ((gs - 1) % 30) + 1),
  case
    when gs % 11 = 0 then 'Escalate supplier for immediate corrective action.'
    when gs % 5 = 0 then 'Monitor recurring quality issues and response times.'
    else 'Supplier operating within expected controls.'
  end,
  case when gs % 11 = 0 then 'High' when gs % 5 = 0 then 'Medium' else 'Low' end,
  now() - make_interval(days => (gs % 360)),
  now() - make_interval(days => (gs % 90))
from src
where not exists (
  select 1
  from public.risk_assessments ra
  where ra.id = ('b0000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.grn_quality_checks (
  id,
  grn_id,
  checks,
  notes,
  photo_url,
  created_at
)
select
  ('c0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('d0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  jsonb_build_object(
    'packaging_intact', gs % 7 <> 0,
    'correct_label', gs % 9 <> 0,
    'temperature_ok', gs % 13 <> 0,
    'expiry_ok', gs % 17 <> 0
  ),
  case
    when gs % 13 = 0 then 'Temperature excursion flagged during receiving.'
    when gs % 9 = 0 then 'Label variance found and escalated for review.'
    when gs % 7 = 0 then 'Packaging dent observed; hold requested.'
    else 'Quality checks completed with no critical exception.'
  end,
  format('https://sample.local/grn-checks/%s.jpg', lpad(gs::text, 4, '0')),
  now() - make_interval(days => (gs % 90), hours => (gs % 12))
from src
where not exists (
  select 1
  from public.grn_quality_checks gqc
  where gqc.id = ('c0000000-0000-0000-0000-' || lpad(src.gs::text, 12, '0'))::uuid
);

with src as (
  select gs
  from generate_series(1, 500) as gs
)
insert into public.qc_inspections (
  grn_id,
  inspector_name,
  status,
  checklist_data,
  inspected_at,
  created_at,
  updated_at,
  result
)
select
  gs,
  format('Inspector %s', ((gs - 1) % 25) + 1),
  case
    when gs % 13 = 0 then 'failed'
    when gs % 7 = 0 then 'requires_review'
    when gs % 3 = 0 then 'passed'
    else 'pending'
  end,
  jsonb_build_object(
    'label_verified', gs % 9 <> 0,
    'seal_intact', gs % 7 <> 0,
    'temperature_pass', gs % 13 <> 0,
    'documentation_complete', gs % 5 <> 0
  ),
  now() - make_interval(days => (gs % 75), hours => (gs % 8)),
  now() - make_interval(days => (gs % 75), hours => (gs % 8)),
  now() - make_interval(days => (gs % 15)),
  case
    when gs % 13 = 0 then 'Critical failure requiring disposition decision.'
    when gs % 7 = 0 then 'Inspection requires secondary QA review.'
    when gs % 3 = 0 then 'Inspection passed.'
    else 'Inspection still pending.'
  end
from src
where not exists (
  select 1
  from public.qc_inspections qi
  where qi.grn_id = src.gs
);

commit;
