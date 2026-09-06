-- Payslip email delivery. A payrun is sent by queueing one job per payslip, and
-- this table is the record of what that queue did: it is what the payroll screen
-- reads back after a send, and what tells an operator which employees still need
-- a working address before a re-send.

CREATE TABLE IF NOT EXISTS payslip_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One row per payslip: a re-send replaces the outcome rather than appending,
  -- so the screen shows the current state of each recipient without a subquery.
  payslip_id UUID NOT NULL UNIQUE REFERENCES payslips(id) ON DELETE CASCADE,
  payrun_id UUID NOT NULL REFERENCES payruns(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- The address actually used, which may be an override typed at send time and
  -- is therefore not always the address on the payslip.
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  job_id TEXT NOT NULL DEFAULT '',
  message_id TEXT NOT NULL DEFAULT '',
  queued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payslip_deliveries DROP CONSTRAINT IF EXISTS payslip_deliveries_status_check;

ALTER TABLE payslip_deliveries ADD CONSTRAINT payslip_deliveries_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed'));

CREATE INDEX IF NOT EXISTS payslip_deliveries_payrun_id_idx
  ON payslip_deliveries (payrun_id);

CREATE INDEX IF NOT EXISTS payslip_deliveries_status_idx
  ON payslip_deliveries (status);

-- Sending payroll to employees is a separate act from editing it: a payroll
-- user computes and validates, and the same permission should not be what lets
-- an outbound email leave the system.
INSERT INTO permissions (code, description) VALUES
  ('payslip:send', 'Email payslips to employees')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'payslip:send'
WHERE r.name IN ('admin', 'hr_payroll_manager', 'hr_payroll_user')
ON CONFLICT DO NOTHING;
