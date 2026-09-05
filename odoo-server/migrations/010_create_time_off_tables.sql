-- Time off: leave types, per-employee allocations, and the requests drawing on them.
--
-- charges, consumptions and history are JSONB rather than child tables because
-- they are derived/append-only arrays: the service always recomputes or appends
-- the whole array and writes it back in one statement, and nothing filters,
-- joins or aggregates them in SQL. Balances are derived by reading the rows
-- whole. Promote them to tables the day something needs to query them
-- field-wise -- this is a deliberate choice, not an oversight.

CREATE TABLE IF NOT EXISTS time_off_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  unit TEXT NOT NULL,
  requires_allocation BOOLEAN NOT NULL DEFAULT false,
  approval TEXT NOT NULL,
  payroll TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_types_unit_check
    CHECK (unit IN ('days', 'hours')),
  CONSTRAINT time_off_types_approval_check
    CHECK (approval IN ('manager', 'none')),
  CONSTRAINT time_off_types_payroll_check
    CHECK (payroll IN ('paid', 'unpaid')),
  CONSTRAINT time_off_types_code_check
    CHECK (code ~ '^[A-Z0-9_-]{1,16}$'),
  CONSTRAINT time_off_types_name_check
    CHECK (char_length(name) BETWEEN 1 AND 100)
);

-- Case-insensitive uniqueness: "Paid Time Off" and "paid time off" are one type.
CREATE UNIQUE INDEX IF NOT EXISTS time_off_types_name_unique_idx
  ON time_off_types (lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS time_off_types_code_unique_idx
  ON time_off_types (lower(code));

CREATE TABLE IF NOT EXISTS time_off_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_id UUID NOT NULL REFERENCES time_off_types(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL,
  valid_from DATE NOT NULL,
  -- NULL means open-ended. The wire format uses '' instead; the repository maps.
  valid_to DATE,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_allocations_status_check
    CHECK (status IN ('pending', 'approved', 'refused')),
  CONSTRAINT time_off_allocations_amount_check
    CHECK (amount > 0 AND amount <= 100000),
  CONSTRAINT time_off_allocations_range_check
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS time_off_allocations_employee_type_idx
  ON time_off_allocations (employee_id, type_id);

CREATE INDEX IF NOT EXISTS time_off_allocations_status_idx
  ON time_off_allocations (status);

CREATE TABLE IF NOT EXISTS time_off_requests (
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
