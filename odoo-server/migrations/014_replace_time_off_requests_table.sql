-- Some databases already have the redesigned table from
-- 010_create_time_off_tables.sql. Preserve that table and its requests.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('time_off_requests')
      AND attname = 'type_id' AND NOT attisdropped
  ) THEN
    RETURN;
  END IF;

  IF to_regclass('time_off_requests') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM time_off_requests) THEN
      RAISE EXCEPTION 'Legacy time_off_requests contains data; convert existing requests before replacing the table';
    END IF;
  END IF;

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

END;
$$;
