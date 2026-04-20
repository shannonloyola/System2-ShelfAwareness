-- Create risk_assessments table for supplier compliance audits
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  audit_date DATE NOT NULL,
  compliance_status TEXT NOT NULL CHECK (compliance_status IN ('Compliant', 'Non-Compliant', 'Under Review')),
  findings TEXT,
  assessor_name TEXT NOT NULL,
  risk_notes TEXT,
  risk_level TEXT NOT NULL DEFAULT 'Low' CHECK (risk_level IN ('Low', 'Medium', 'High')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_risk_assessments"
  ON public.risk_assessments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "allow_insert_risk_assessments"
  ON public.risk_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_supplier ON public.risk_assessments(supplier_name);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON public.risk_assessments(risk_level);