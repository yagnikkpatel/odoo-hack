-- Phase 1 · BR-EMP-7, BR-X-9
-- Departments, job positions, employment types, and the reference-number allocator.

CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  parent_id  UUID REFERENCES departments (id) ON DELETE SET NULL,
  -- manager_id is added in 008, once employees exists (the two tables reference each other).
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS departments_parent_id_idx ON departments (parent_id);

CREATE TABLE IF NOT EXISTS job_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_positions_department_id_idx ON job_positions (department_id);

CREATE TABLE IF NOT EXISTS employment_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  code       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO employment_types (name, code) VALUES
  ('Full-time', 'FULL_TIME'),
  ('Part-time', 'PART_TIME'),
  ('Contract',  'CONTRACT'),
  ('Intern',    'INTERN')
ON CONFLICT (code) DO NOTHING;

-- Reference numbers are allocated by locking a row here, never by MAX(...) + 1 (BR-X-9).
CREATE TABLE IF NOT EXISTS number_sequences (
  key          TEXT PRIMARY KEY,
  prefix       TEXT NOT NULL,
  next_value   BIGINT NOT NULL DEFAULT 1 CHECK (next_value > 0),
  padding      SMALLINT NOT NULL DEFAULT 4 CHECK (padding BETWEEN 1 AND 12),
  period_scope TEXT NOT NULL DEFAULT 'none' CHECK (period_scope IN ('none','year','month')),
  scope_key    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO number_sequences (key, prefix, padding, period_scope) VALUES
  ('employee', 'EMP-',  4, 'none'),
  ('contract', 'CON/',  4, 'year'),
  ('payslip',  'SLIP/', 4, 'month')
ON CONFLICT (key) DO NOTHING;
