CREATE TABLE IF NOT EXISTS supplier_scorecard_cache (
  supplier_key TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  total_pos INTEGER NOT NULL DEFAULT 0,
  approved_pos INTEGER NOT NULL DEFAULT 0,
  po_approval_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_receipts INTEGER NOT NULL DEFAULT 0,
  on_time_receipts INTEGER NOT NULL DEFAULT 0,
  on_time_delivery_pct NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_discrepancies INTEGER NOT NULL DEFAULT 0,
  approved_discrepancies INTEGER NOT NULL DEFAULT 0,
  rejected_discrepancies INTEGER NOT NULL DEFAULT 0,
  avg_discrepancy_units NUMERIC(10,2) NOT NULL DEFAULT 0,
  defect_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  reliability_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL,
  risk_summary TEXT NOT NULL,
  source_month DATE NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_scorecard_cache_name_idx
  ON supplier_scorecard_cache (supplier_name);

CREATE OR REPLACE FUNCTION set_supplier_scorecard_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_scorecard_cache_set_updated_at ON supplier_scorecard_cache;

CREATE TRIGGER supplier_scorecard_cache_set_updated_at
BEFORE UPDATE ON supplier_scorecard_cache
FOR EACH ROW
EXECUTE FUNCTION set_supplier_scorecard_cache_updated_at();
