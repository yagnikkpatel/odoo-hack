-- Payroll. Configuration lives in salary_rules + salary_structures; processing
-- lives in payruns + payslips. A payrun groups one payslip per selected
-- employee for one period, and computing it runs the structure's salary rules
-- in ascending sequence against the employee's applicable contract.
--
-- payslips.lines and the warnings columns are JSONB for the same reason
-- time_off_requests.charges is (see 013): they are a derived snapshot rewritten
-- wholesale on every compute and never filtered, joined or aggregated in SQL.
-- Promote them to child tables the day something queries a line field-wise --
-- this is a deliberate choice, not an oversight.

-- Two migrations recorded on some development databases,
-- 011_create_salary_structures_table.sql and 012_create_salary_rules_table.sql,
-- created an earlier payroll schema and were then dropped from the repository:
-- a fresh database can no longer reproduce them and no committed code reads
-- them. Their salary_rules is shaped differently from the one below -- a rule
-- belonged to exactly one structure, and the computation lived in
-- computation_type/percentage_base rather than method/base -- so the two cannot
-- be reconciled column by column. No payrun has ever been created against them,
-- so removing them is safe, and it is the only way a fresh database and a
-- database still carrying them end up on the same schema.
DROP TABLE IF EXISTS salary_rules CASCADE;

DROP TABLE IF EXISTS salary_structures CASCADE;

-- Payroll needs contract terms the contracts module never recorded. Existing
-- rows keep the monthly INR basis the seeds and the client already assume.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS wage_period TEXT NOT NULL DEFAULT 'month';

-- Dropped first so the statement matches the IF NOT EXISTS style of the rest of
-- this file and stays safe to re-run.
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_currency_check;

ALTER TABLE contracts ADD CONSTRAINT contracts_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_wage_period_check;

ALTER TABLE contracts ADD CONSTRAINT contracts_wage_period_check
  CHECK (wage_period IN ('month', 'year', 'hour'));

CREATE TABLE IF NOT EXISTS salary_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  method TEXT NOT NULL,
  -- Only the column matching `method` is read; the others keep their default
  -- so switching a rule's method never loses the operator's previous entry.
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  percentage NUMERIC(9, 4) NOT NULL DEFAULT 0,
  base TEXT NOT NULL DEFAULT '',
  formula TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_rules_category_check
    CHECK (category IN ('basic', 'allowance', 'gross', 'deduction', 'contribution', 'net')),
  CONSTRAINT salary_rules_method_check
    CHECK (method IN ('fixed', 'percentage', 'formula')),
  CONSTRAINT salary_rules_code_check
    CHECK (code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  CONSTRAINT salary_rules_name_check
    CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT salary_rules_sequence_check
    CHECK (sequence >= 0 AND sequence <= 100000),
  CONSTRAINT salary_rules_amount_check
    CHECK (amount >= 0),
  CONSTRAINT salary_rules_percentage_check
    CHECK (percentage >= 0 AND percentage <= 1000)
);

-- Codes are the identifiers formulas reference, so they are unique globally
-- rather than per structure.
CREATE UNIQUE INDEX IF NOT EXISTS salary_rules_code_unique_idx
  ON salary_rules (code);

CREATE INDEX IF NOT EXISTS salary_rules_sequence_idx
  ON salary_rules (sequence);

CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_structures_name_check
    CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- Case-insensitive uniqueness: "Regular Salary" and "regular salary" are one
-- structure.
CREATE UNIQUE INDEX IF NOT EXISTS salary_structures_name_unique_idx
  ON salary_structures (lower(name));

CREATE TABLE IF NOT EXISTS salary_structure_rules (
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES salary_rules(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (structure_id, rule_id)
);

CREATE INDEX IF NOT EXISTS salary_structure_rules_rule_idx
  ON salary_structure_rules (rule_id);

CREATE TABLE IF NOT EXISTS payruns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payruns_status_check
    CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
  CONSTRAINT payruns_range_check
    CHECK (end_date >= start_date),
  CONSTRAINT payruns_name_check
    CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS payruns_status_idx ON payruns (status);

CREATE INDEX IF NOT EXISTS payruns_period_idx ON payruns (start_date DESC);

CREATE INDEX IF NOT EXISTS payruns_structure_idx ON payruns (structure_id);

-- The employees the payrun was created for. Compute derives one payslip per
-- row, so a payrun never reaches employees who were not selected.
CREATE TABLE IF NOT EXISTS payrun_employees (
  payrun_id UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payrun_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payrun_employees_employee_idx
  ON payrun_employees (employee_id);

CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payrun_id UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
  -- Snapshot columns. Validated payroll is history: it must keep reading the
  -- way it was paid even after the employee, contract or structure changes.
  employee_name TEXT NOT NULL,
  employee_email TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  job_position TEXT NOT NULL DEFAULT '',
  structure_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'computed',
  currency TEXT NOT NULL DEFAULT 'INR',
  worked_days NUMERIC(7, 2) NOT NULL DEFAULT 0,
  worked_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  expected_days NUMERIC(7, 2) NOT NULL DEFAULT 0,
  expected_hours NUMERIC(9, 2) NOT NULL DEFAULT 0,
  basic NUMERIC(14, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(14, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  contributions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net NUMERIC(14, 2) NOT NULL DEFAULT 0,
  bank_account TEXT NOT NULL DEFAULT '',
  contract_snapshot JSONB,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payslips_status_check
    CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
  CONSTRAINT payslips_range_check
    CHECK (end_date >= start_date)
);

-- One payslip per employee per payrun. Recomputing replaces the row instead of
-- adding a second one.
CREATE UNIQUE INDEX IF NOT EXISTS payslips_payrun_employee_idx
  ON payslips (payrun_id, employee_id);

CREATE INDEX IF NOT EXISTS payslips_employee_period_idx
  ON payslips (employee_id, start_date DESC);

CREATE INDEX IF NOT EXISTS payslips_status_idx ON payslips (status);

-- Payment account used at validation time. Payroll owns it rather than the
-- employee profile because it is only ever read and written by payroll.
CREATE TABLE IF NOT EXISTS employee_bank_accounts (
  employee_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_bank_accounts_number_check
    CHECK (char_length(account_number) BETWEEN 4 AND 64)
);
