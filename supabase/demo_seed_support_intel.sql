-- Demo seed: Support and Intel project
-- Run this in Supabase project: gxeqtthumaujxjbnrsqd
-- Supports: notifications, documents, reporting snapshots

begin;

insert into public.notifications (
  source_domain,
  entity_type,
  entity_id,
  title,
  message,
  severity,
  status,
  created_at,
  read_at
)
select *
from (
  values
    ('fulfillment', 'backorder', 'RO-MAY26-001:AMOX-500-CAP', 'Backorder Escalation', 'Amoxicillin backorders remain open and need inbound replenishment action.', 'warning', 'unread', '2026-05-19 09:12+08'::timestamptz, null::timestamptz),
    ('quality', 'discrepancy', 'GRN-MAY26-004:INS-GLAR-100-PEN', 'QC Hold Active', 'Cold-chain discrepancy is pending manager review before release.', 'critical', 'unread', '2026-05-19 09:25+08'::timestamptz, null::timestamptz),
    ('supply_chain', 'purchase_order', 'PO-MAY26-005', 'Customs Delay', 'NorthStar Generics shipment is still stuck at customs.', 'warning', 'read', '2026-05-19 14:25+08'::timestamptz, '2026-05-19 14:40+08'::timestamptz),
    ('supply_chain', 'purchase_order', 'PO-MAY26-006', 'Supplier Packed', 'Summit Biocare packed the order and is awaiting pickup.', 'info', 'archived', '2026-05-19 10:45+08'::timestamptz, '2026-05-19 11:00+08'::timestamptz)
) as seed(source_domain, entity_type, entity_id, title, message, severity, status, created_at, read_at)
where not exists (
  select 1
  from public.notifications n
  where n.entity_id = seed.entity_id
    and n.created_at = seed.created_at
);

insert into public.documents (
  source_domain,
  entity_type,
  entity_id,
  file_name,
  file_type,
  storage_bucket,
  storage_path,
  file_url,
  uploaded_by,
  uploaded_at,
  tags,
  metadata
)
select *
from (
  values
    ('supply_chain', 'purchase_order', 'PO-MAY26-001', 'po-may26-001.pdf', 'application/pdf', 'documents', 'demo/po/po-may26-001.pdf', 'https://example.com/docs/po-may26-001.pdf', 'procurement@test.com', '2026-05-02 13:05+08'::timestamptz, '["po","approved","inbound"]'::jsonb, '{"supplier":"HealthMed Supply","status":"Received"}'::jsonb),
    ('quality', 'shipment_discrepancy', 'GRN-MAY26-004:INS-GLAR-100-PEN', 'insulin-qc-photos.zip', 'application/zip', 'documents', 'demo/qc/insulin-qc-photos.zip', 'https://example.com/docs/insulin-qc-photos.zip', 'qc@test.com', '2026-05-18 10:50+08'::timestamptz, '["qc","evidence","cold-chain"]'::jsonb, '{"supplier":"ColdChain Rx Logistics","severity":"Major"}'::jsonb),
    ('fulfillment', 'grn', 'GRN-MAY26-001', 'grn-may26-001-signed.pdf', 'application/pdf', 'documents', 'demo/grn/grn-may26-001-signed.pdf', 'https://example.com/docs/grn-may26-001-signed.pdf', 'warehouse@test.com', '2026-05-09 16:10+08'::timestamptz, '["grn","receiving"]'::jsonb, '{"status":"posted"}'::jsonb)
) as seed(source_domain, entity_type, entity_id, file_name, file_type, storage_bucket, storage_path, file_url, uploaded_by, uploaded_at, tags, metadata)
where not exists (
  select 1
  from public.documents d
  where d.storage_path = seed.storage_path
);

insert into public.report_snapshots (
  report_name,
  report_type,
  report_period_start,
  report_period_end,
  generated_at,
  generated_by,
  payload,
  notes
)
select *
from (
  values
    ('Executive Dashboard', 'dashboard', '2026-05-01'::date, '2026-05-31'::date, '2026-05-20 08:00+08'::timestamptz, 'owner@test.com', '{"budget_used_pct":75.17,"backorders_open":3,"customs_delays":1,"low_stock_items":4}'::jsonb, 'Monthly demo snapshot for leadership review.'),
    ('Supplier Reliability Summary', 'summary', '2026-05-01'::date, '2026-05-31'::date, '2026-05-20 08:05+08'::timestamptz, 'procurement@test.com', '{"top_supplier":"HealthMed Supply","watchlist":["ColdChain Rx Logistics","NorthStar Generics"]}'::jsonb, 'Prepared for procurement and QA demo.'),
    ('Warehouse Exceptions', 'detail', '2026-05-01'::date, '2026-05-31'::date, '2026-05-20 08:10+08'::timestamptz, 'warehouse@test.com', '{"qc_holds":1,"open_backorders":3,"count_corrections":1}'::jsonb, 'Operational exception summary.')
) as seed(report_name, report_type, report_period_start, report_period_end, generated_at, generated_by, payload, notes)
where not exists (
  select 1
  from public.report_snapshots rs
  where rs.report_name = seed.report_name
    and rs.generated_at = seed.generated_at
);

commit;
