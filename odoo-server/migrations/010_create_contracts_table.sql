-- Phase 2 · BR-CON-1…8
-- Period-scoped employment terms. Payroll reads wage and schedule from here.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  reference           TEXT NOT NULL UNIQUE,
  start_date          DATE NOT NULL,
  end_date            DATE,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','running','expired','cancelled')),
  employment_type_id  UUID NOT NULL REFERENCES employment_types (id)  ON DELETE RESTRICT,
  department_id       UUID REFERENCES departments (id)                ON DELETE SET NULL,
  job_position_id     UUID REFERENCES job_positions (id)              ON DELETE SET NULL,
  working_schedule_id UUID NOT NULL REFERENCES working_schedules (id) ON DELETE RESTRICT,
  salary_structure_id UUID NOT NULL REFERENCES salary_structures (id) ON DELETE RESTRICT,
  wage                NUMERIC(14,2) NOT NULL CHECK (wage >= 0),
  wage_type           TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (wage_type IN ('monthly','hourly','daily')),
  currency_code       CHAR(3) NOT NULL DEFAULT 'INR',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contracts_date_order CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS contracts_employee_id_idx ON contracts (employee_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx      ON contracts (status);
CREATE INDEX IF NOT EXISTS contracts_period_idx      ON contracts (start_date, end_date);

-- BR-CON-1: an employee has at most one contract in force on any given date.
-- Drafts and cancelled contracts may overlap freely; anything that has ever been in force
-- cannot. This is the backstop the payroll contract resolution depends on being able to
-- return zero or one row, never two.
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_no_overlap;
ALTER TABLE contracts ADD CONSTRAINT contracts_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
  ) WHERE (status IN ('running', 'expired'));
