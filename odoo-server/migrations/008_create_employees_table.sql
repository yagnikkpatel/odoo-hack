-- Phase 1 · BR-EMP-1…8
-- The employee master: the hub every other module hangs off.

CREATE TABLE IF NOT EXISTS employees (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One login per employee, at most (BR-EMP-6). Nullable: HR creates the record first.
  user_id                   UUID UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  employee_number           TEXT NOT NULL UNIQUE,
  first_name                TEXT NOT NULL CHECK (length(trim(first_name)) > 0),
  last_name                 TEXT NOT NULL CHECK (length(trim(last_name))  > 0),
  work_email                TEXT UNIQUE,
  personal_email            TEXT,
  work_phone                TEXT,
  mobile_phone              TEXT,
  photo_url                 TEXT,
  photo_public_id           TEXT,
  date_of_birth             DATE,
  gender                    TEXT CHECK (gender IN ('male','female','other','undisclosed')),
  marital_status            TEXT,
  address_line1             TEXT,
  address_line2             TEXT,
  city                      TEXT,
  state                     TEXT,
  postal_code               TEXT,
  country                   TEXT,
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  department_id             UUID REFERENCES departments (id)      ON DELETE SET NULL,
  job_position_id           UUID REFERENCES job_positions (id)    ON DELETE SET NULL,
  manager_id                UUID REFERENCES employees (id)        ON DELETE SET NULL,
  working_schedule_id       UUID REFERENCES working_schedules (id) ON DELETE SET NULL,
  employment_status         TEXT NOT NULL DEFAULT 'active'
                              CHECK (employment_status IN ('active','on_leave','suspended','terminated')),
  hire_date                 DATE,
  termination_date          DATE,
  bank_name                 TEXT,
  bank_account_number       TEXT,
  bank_ifsc                 TEXT,
  tax_identification_number TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- An employee cannot manage themselves (BR-EMP-3); deeper cycles are caught in the service.
  CONSTRAINT employees_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id),
  -- BR-EMP-5
  CONSTRAINT employees_termination_after_hire
    CHECK (termination_date IS NULL OR hire_date IS NULL OR termination_date >= hire_date)
);

CREATE INDEX IF NOT EXISTS employees_department_id_idx      ON employees (department_id);
CREATE INDEX IF NOT EXISTS employees_job_position_id_idx    ON employees (job_position_id);
CREATE INDEX IF NOT EXISTS employees_manager_id_idx         ON employees (manager_id);
CREATE INDEX IF NOT EXISTS employees_employment_status_idx  ON employees (employment_status);
CREATE INDEX IF NOT EXISTS employees_working_schedule_idx   ON employees (working_schedule_id);

-- The deferred half of the circular reference (see 006).
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS departments_manager_id_idx ON departments (manager_id);
