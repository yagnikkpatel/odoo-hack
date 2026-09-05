-- Phase 0 · BR-AUTH-2, BR-AUTH-5, BR-RBAC-4, BR-RBAC-5
-- Extends the existing roles/users tables and seeds the five PeoplePay360 roles.

ALTER TABLE roles ADD COLUMN IF NOT EXISTS label TEXT;

INSERT INTO roles (name, label) VALUES
  ('employee',           'Employee'),
  ('hr_manager',         'HR Manager'),
  ('hr_payroll_user',    'HR Payroll User'),
  ('hr_payroll_manager', 'HR Payroll Manager'),
  ('admin',              'Admin')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

-- the 002 seed inserted 'admin' with no label; the upsert above fills it.
UPDATE roles SET label = initcap(replace(name, '_', ' ')) WHERE label IS NULL;
ALTER TABLE roles ALTER COLUMN label SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_is_active_idx ON users (is_active);
