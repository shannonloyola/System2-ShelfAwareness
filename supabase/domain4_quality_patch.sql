-- Domain 4: Quality & Compliance Patch
-- Target project: jbfzhlalkjbtbitvxeog

CREATE TABLE IF NOT EXISTS public.qc_inspections (
  inspection_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grn_id bigint NOT NULL,
  inspector_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'requires_review')),
  checklist_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  inspected_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  result text -- Added for compatibility with frontend result check
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_qc_inspections_updated_at ON public.qc_inspections;
CREATE TRIGGER trg_qc_inspections_updated_at
BEFORE UPDATE ON public.qc_inspections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
