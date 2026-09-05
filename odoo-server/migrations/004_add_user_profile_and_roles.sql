INSERT INTO roles (name)
VALUES
  ('employee'),
  ('hr_manager'),
  ('hr_payroll_user'),
  ('hr_payroll_manager')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL;

ALTER TABLE users ALTER COLUMN name SET NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'));
