-- The former 011_create_payroll_tables migration used a different schema.
-- CREATE TABLE IF NOT EXISTS in 015 preserves those tables but cannot add the
-- columns the current repositories need. Upgrade them without dropping data.
ALTER TABLE payruns
  ADD COLUMN IF NOT EXISTS warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS expected_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_account TEXT NOT NULL DEFAULT '';

-- The current engine supports fractional days. Older tables used integers.
ALTER TABLE payslips
  ALTER COLUMN expected_days TYPE NUMERIC(7, 2),
  ALTER COLUMN worked_days TYPE NUMERIC(7, 2);

ALTER TABLE salary_structure_rules
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
