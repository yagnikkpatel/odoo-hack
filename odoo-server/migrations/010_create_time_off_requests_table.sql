CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_off_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_requests_type_check
    CHECK (time_off_type IN ('paid_time_off', 'sick_leave', 'comp_off')),
  CONSTRAINT time_off_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT time_off_requests_date_order_check
    CHECK (end_date >= start_date),
  -- A decided request always records who decided it and when; a pending one never does.
  CONSTRAINT time_off_requests_decision_check
    CHECK (
      (status = 'pending' AND approver_id IS NULL AND decided_at IS NULL)
      OR (status <> 'pending' AND approver_id IS NOT NULL AND decided_at IS NOT NULL)
    ),
  CONSTRAINT time_off_requests_approver_not_self
    CHECK (approver_id IS NULL OR approver_id <> employee_id),
  -- Race-proof overlap guard: an employee cannot hold two live requests covering
  -- the same day. Rejected requests are excluded so those dates free up again.
  CONSTRAINT time_off_requests_no_overlap
    EXCLUDE USING GIST (
      employee_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status <> 'rejected')
);

CREATE INDEX IF NOT EXISTS time_off_requests_employee_start_idx
  ON time_off_requests (employee_id, start_date DESC);

CREATE INDEX IF NOT EXISTS time_off_requests_status_idx
  ON time_off_requests (status);

CREATE INDEX IF NOT EXISTS time_off_requests_start_date_idx
  ON time_off_requests (start_date DESC);

-- Older branches already created the redesigned table under a different
-- migration filename. Only the legacy schema has this column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'time_off_requests'::regclass
      AND attname = 'time_off_type' AND NOT attisdropped
  ) THEN
    CREATE INDEX IF NOT EXISTS time_off_requests_type_idx
      ON time_off_requests (time_off_type);
  END IF;
END;
$$;
