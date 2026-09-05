-- Phase 1 (tables only; the API is Phase 2) · BR-SCH-1, BR-SCH-2
-- Created here because employees.working_schedule_id references it, and migrations run in
-- filename order — 007 must exist before 008.

CREATE TABLE IF NOT EXISTS working_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL UNIQUE,
  schedule_type  TEXT NOT NULL DEFAULT 'full_time'
                   CHECK (schedule_type IN ('full_time','part_time','flexible')),
  timezone       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  -- Derived from the lines by the service, never accepted from a client (BR-SCH-1).
  hours_per_week NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (hours_per_week >= 0),
  is_flexible    BOOLEAN NOT NULL DEFAULT FALSE,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS working_schedule_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  working_schedule_id UUID NOT NULL REFERENCES working_schedules (id) ON DELETE CASCADE,
  day_of_week         SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  day_period          TEXT NOT NULL DEFAULT 'full_day'
                        CHECK (day_period IN ('morning','afternoon','full_day')),
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  break_minutes       INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  CONSTRAINT working_schedule_lines_time_order CHECK (end_time > start_time),
  CONSTRAINT working_schedule_lines_break_fits
    CHECK (break_minutes < EXTRACT(EPOCH FROM (end_time - start_time)) / 60)
);

CREATE INDEX IF NOT EXISTS working_schedule_lines_schedule_idx
  ON working_schedule_lines (working_schedule_id, day_of_week);
