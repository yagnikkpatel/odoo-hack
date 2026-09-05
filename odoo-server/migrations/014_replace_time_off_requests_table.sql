-- 010_create_time_off_requests_table.sql created time_off_requests with a
-- narrower schema (free-text type, no link to time_off_types/allocations).
-- The module was later redesigned around time_off_types and
-- time_off_allocations (013_create_time_off_types_and_allocations_tables.sql),
-- but that table already existed by then so it could never be created with
-- the new columns (type_id, unit, duration, charges, consumptions, history)
-- the current repository/service expect -- every request against it has been
-- failing. No environment has ever had a row in it, so it is safe to drop and
-- recreate rather than write a column-by-column ALTER migration.
DROP TABLE IF EXISTS time_off_requests;

CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- '' for the days unit, 'HH:MM' for the hours unit.
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL,
  duration NUMERIC(10, 2) NOT NULL,
  charges JSONB NOT NULL DEFAULT '[]'::jsonb,
  consumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_requests_status_check
    CHECK (status IN ('pending', 'approved', 'refused', 'cancelled')),
  CONSTRAINT time_off_requests_unit_check
    CHECK (unit IN ('days', 'hours')),
  CONSTRAINT time_off_requests_range_check
    CHECK (end_date >= start_date),
  CONSTRAINT time_off_requests_duration_check
    CHECK (duration > 0)
);

CREATE INDEX IF NOT EXISTS time_off_requests_employee_start_idx
  ON time_off_requests (employee_id, start_date DESC);

CREATE INDEX IF NOT EXISTS time_off_requests_status_idx
  ON time_off_requests (status);

CREATE INDEX IF NOT EXISTS time_off_requests_type_idx
  ON time_off_requests (type_id);
