CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  wage NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contracts_status_check CHECK (status IN ('running', 'expired')),
  CONSTRAINT contracts_wage_check CHECK (wage > 0),
  CONSTRAINT contracts_date_range_check CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS contracts_employee_id_idx ON contracts (employee_id);

CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts (status);

CREATE UNIQUE INDEX IF NOT EXISTS contracts_one_running_per_employee_idx
  ON contracts (employee_id)
  WHERE status = 'running';
