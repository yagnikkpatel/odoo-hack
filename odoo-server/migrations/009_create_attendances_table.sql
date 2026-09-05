CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  worked_hours NUMERIC(5, 2) GENERATED ALWAYS AS (
    CASE
      WHEN check_in IS NULL OR check_out IS NULL THEN 0
      ELSE ROUND(
        (EXTRACT(EPOCH FROM (check_out - check_in)) / 3600.0)::numeric,
        2
      )
    END
  ) STORED,
  overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'incomplete',
  edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendances_status_check
    CHECK (status IN ('present', 'absent', 'incomplete')),
  CONSTRAINT attendances_overtime_check
    CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  CONSTRAINT attendances_time_order_check
    CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in),
  CONSTRAINT attendances_checkout_requires_checkin_check
    CHECK (check_out IS NULL OR check_in IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS attendances_employee_date_idx
  ON attendances (employee_id, attendance_date);

CREATE INDEX IF NOT EXISTS attendances_date_idx
  ON attendances (attendance_date DESC);

CREATE INDEX IF NOT EXISTS attendances_status_idx
  ON attendances (status);

CREATE INDEX IF NOT EXISTS attendances_open_session_idx
  ON attendances (employee_id, check_in DESC)
  WHERE check_out IS NULL;
