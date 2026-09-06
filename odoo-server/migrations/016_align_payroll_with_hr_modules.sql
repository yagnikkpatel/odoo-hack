-- Reconciles payroll with the modules it reads from and with the payroll
-- screens it is built against.

-- 015 gave payslips.employee_id ON DELETE CASCADE, copying the convention the
-- contracts and attendances tables use. That is wrong for payroll: deleting an
-- employee would take their validated and paid payslips with them, and paid
-- payroll has to remain available as historical data. RESTRICT keeps the
-- record; an employee who has been paid is deactivated rather than deleted.
ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_employee_id_fkey;

ALTER TABLE payslips ADD CONSTRAINT payslips_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE RESTRICT;

-- A salary rule multiplies its computed result by a quantity, so one rule can
-- express "this amount, this many times". 1 leaves every existing rule exactly
-- as it calculates today.
ALTER TABLE salary_rules ADD COLUMN IF NOT EXISTS quantity NUMERIC(9, 2) NOT NULL DEFAULT 1;

ALTER TABLE salary_rules DROP CONSTRAINT IF EXISTS salary_rules_quantity_check;

ALTER TABLE salary_rules ADD CONSTRAINT salary_rules_quantity_check
  CHECK (quantity >= 0 AND quantity <= 10000);

-- The payroll dashboard is offered to HR managers, but 007 gave the role no
-- payroll permissions at all, so every read it made was refused. Reading is all
-- it needs: processing and configuration stay with the payroll roles.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY['payrun:read', 'payslip:read'])
WHERE r.name = 'hr_manager'
ON CONFLICT DO NOTHING;
