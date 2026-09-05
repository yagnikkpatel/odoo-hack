-- Payroll: salary rules, salary structures, payruns, payslips, bank details.
-- Money is INR; contract wages are monthly amounts.

CREATE TABLE IF NOT EXISTS salary_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 10,
  method TEXT NOT NULL DEFAULT 'fixed',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  percentage NUMERIC(8, 4) NOT NULL DEFAULT 0,
  base TEXT NOT NULL DEFAULT '',
  formula TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_rules_code_check CHECK (code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  CONSTRAINT salary_rules_category_check CHECK (
    category IN ('basic', 'allowance', 'gross', 'deduction', 'contribution', 'net')
  ),
  CONSTRAINT salary_rules_method_check CHECK (
    method IN ('fixed', 'percentage', 'formula')
  ),
  CONSTRAINT salary_rules_sequence_check CHECK (sequence >= 0),
  CONSTRAINT salary_rules_amount_check CHECK (amount >= 0),
  CONSTRAINT salary_rules_percentage_check CHECK (percentage >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS salary_rules_code_unique_idx
  ON salary_rules (code);

CREATE TABLE IF NOT EXISTS salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS salary_structures_name_unique_idx
  ON salary_structures (lower(name));

CREATE TABLE IF NOT EXISTS salary_structure_rules (
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES salary_rules(id) ON DELETE RESTRICT,
  PRIMARY KEY (structure_id, rule_id)
);

-- Contracts carry the payroll context: which structure applies and what kind of
-- staff the contract covers (the dashboard's "employee type" filter).
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS salary_structure_id UUID
    REFERENCES salary_structures(id) ON DELETE SET NULL;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'full_time';

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_employment_type_check;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_employment_type_check CHECK (
    employment_type IN ('full_time', 'part_time', 'contract', 'intern')
  );

CREATE INDEX IF NOT EXISTS contracts_salary_structure_id_idx
  ON contracts (salary_structure_id);

-- Indian bank transfer details; payroll refuses to validate a payslip without them.
CREATE TABLE IF NOT EXISTS employee_bank_details (
  employee_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_holder TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL,
  ifsc TEXT NOT NULL,
  bank_name TEXT NOT NULL DEFAULT '',
  pan TEXT NOT NULL DEFAULT '',
  uan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_bank_details_account_check
    CHECK (account_number ~ '^[0-9]{9,18}$'),
  CONSTRAINT employee_bank_details_ifsc_check
    CHECK (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  CONSTRAINT employee_bank_details_pan_check
    CHECK (pan = '' OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  CONSTRAINT employee_bank_details_uan_check
    CHECK (uan = '' OR uan ~ '^[0-9]{12}$')
);

CREATE TABLE IF NOT EXISTS payruns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  structure_id UUID NOT NULL REFERENCES salary_structures(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  computed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payruns_status_check
    CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
  CONSTRAINT payruns_date_range_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS payruns_period_idx ON payruns (start_date, end_date);

CREATE INDEX IF NOT EXISTS payruns_status_idx ON payruns (status);

-- Payslips snapshot everything payroll used, so finalized history survives later
-- edits to employees, contracts, rules and structures.
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payrun_id UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft',
  employee_name TEXT NOT NULL,
  employee_email TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  job_position TEXT NOT NULL DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  structure_id UUID REFERENCES salary_structures(id) ON DELETE SET NULL,
  structure_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  period_days INTEGER NOT NULL DEFAULT 0,
  paid_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  unpaid_days NUMERIC(6, 2) NOT NULL DEFAULT 0,
  expected_days INTEGER NOT NULL DEFAULT 0,
  worked_days INTEGER NOT NULL DEFAULT 0,
  worked_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  overtime_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  basic NUMERIC(12, 2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  contributions NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  contract_snapshot JSONB,
  bank_snapshot JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payslips_status_check
    CHECK (status IN ('draft', 'computed', 'validated', 'paid')),
  CONSTRAINT payslips_payrun_employee_unique UNIQUE (payrun_id, employee_id)
);

CREATE INDEX IF NOT EXISTS payslips_employee_id_idx ON payslips (employee_id);

CREATE INDEX IF NOT EXISTS payslips_period_idx ON payslips (start_date, end_date);

CREATE INDEX IF NOT EXISTS payslips_status_idx ON payslips (status);

-- The payroll dashboard is shared with HR managers, who otherwise hold no
-- payroll permission.
INSERT INTO permissions (code, description) VALUES
  ('payroll_dashboard:read', 'View the payroll dashboard and reports')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'payroll_dashboard:read'
WHERE r.name IN ('hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin')
ON CONFLICT DO NOTHING;

-- Default Indian salary configuration. Formulas may use WAGE, PERIOD_DAYS,
-- PAID_DAYS, UNPAID_DAYS, EXPECTED_DAYS, WORKED_DAYS, WORKED_HOURS,
-- OVERTIME_HOURS, earlier rule codes, MIN()/MAX()/ROUND() and comparisons
-- (which evaluate to 1 or 0).
INSERT INTO salary_rules (name, code, category, sequence, method, amount, percentage, base, formula, description) VALUES
  ('Basic salary', 'BASIC', 'basic', 10, 'formula', 0, 0, '', 'WAGE * 0.50 * PAID_DAYS / PERIOD_DAYS', '50% of the monthly wage, prorated for loss-of-pay days.'),
  ('House rent allowance', 'HRA', 'allowance', 20, 'percentage', 0, 40, 'BASIC', '', '40% of basic (non-metro rate).'),
  ('Special allowance', 'SPECIAL', 'allowance', 30, 'formula', 0, 0, '', 'WAGE * PAID_DAYS / PERIOD_DAYS - BASIC - HRA', 'Balancing allowance so gross equals the prorated wage.'),
  ('Gross salary', 'GROSS', 'gross', 40, 'formula', 0, 0, '', 'BASIC + HRA + SPECIAL', 'Total earnings before deductions.'),
  ('Provident fund (employee)', 'PF', 'deduction', 50, 'formula', 0, 0, '', '0.12 * MIN(BASIC, 15000)', 'EPF employee share: 12% of basic, capped at the Rs 15,000 wage ceiling.'),
  ('ESI (employee)', 'ESI', 'deduction', 60, 'formula', 0, 0, '', '(GROSS <= 21000) * 0.0075 * GROSS', 'ESI employee share of 0.75%, only when gross is within the Rs 21,000 threshold.'),
  ('Professional tax', 'PT', 'deduction', 70, 'formula', 0, 0, '', '(GROSS > 15000) * 200', 'Flat state professional tax slab above Rs 15,000 gross.'),
  ('Net salary', 'NET', 'net', 100, 'formula', 0, 0, '', 'GROSS - PF - ESI - PT', 'Take-home pay.'),
  ('Provident fund (employer)', 'PF_EMPLOYER', 'contribution', 110, 'formula', 0, 0, '', '0.12 * MIN(BASIC, 15000)', 'EPF employer share, not deducted from the employee.'),
  ('ESI (employer)', 'ESI_EMPLOYER', 'contribution', 120, 'formula', 0, 0, '', '(GROSS <= 21000) * 0.0325 * GROSS', 'ESI employer share of 3.25%.'),
  ('Professional fee', 'CONSULT_FEE', 'basic', 10, 'formula', 0, 0, '', 'WAGE * PAID_DAYS / PERIOD_DAYS', 'Consultant retainer, prorated for unpaid days.'),
  ('TDS u/s 194J', 'TDS_194J', 'deduction', 50, 'percentage', 0, 10, 'CONSULT_FEE', '', '10% tax deducted at source on professional fees.'),
  ('Net payable', 'CONSULT_NET', 'net', 100, 'formula', 0, 0, '', 'CONSULT_FEE - TDS_194J', 'Amount payable to the consultant.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO salary_structures (name, description) VALUES
  ('Regular Salary (India)', 'Monthly CTC split into basic, HRA and special allowance with EPF, ESI and professional tax.'),
  ('Consultant (TDS 194J)', 'Professional fee with 10% TDS for contract staff.')
ON CONFLICT DO NOTHING;

INSERT INTO salary_structure_rules (structure_id, rule_id)
SELECT s.id, r.id
FROM salary_structures s
JOIN salary_rules r ON r.code = ANY(ARRAY[
  'BASIC', 'HRA', 'SPECIAL', 'GROSS', 'PF', 'ESI', 'PT', 'NET', 'PF_EMPLOYER', 'ESI_EMPLOYER'
])
WHERE lower(s.name) = lower('Regular Salary (India)')
ON CONFLICT DO NOTHING;

INSERT INTO salary_structure_rules (structure_id, rule_id)
SELECT s.id, r.id
FROM salary_structures s
JOIN salary_rules r ON r.code = ANY(ARRAY['CONSULT_FEE', 'TDS_194J', 'CONSULT_NET'])
WHERE lower(s.name) = lower('Consultant (TDS 194J)')
ON CONFLICT DO NOTHING;
