CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  job_position TEXT NOT NULL,
  department TEXT NOT NULL,
  contact TEXT NOT NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  working_schedule TEXT NOT NULL,
  company_name TEXT NOT NULL,
  work_location TEXT NOT NULL,
  location TEXT,
  employee_image_url TEXT,
  employee_image_public_id TEXT,
  company_image_url TEXT,
  company_image_public_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_profiles_manager_not_self
    CHECK (manager_id IS NULL OR manager_id <> user_id)
);

CREATE INDEX IF NOT EXISTS employee_profiles_manager_id_idx
  ON employee_profiles (manager_id);
