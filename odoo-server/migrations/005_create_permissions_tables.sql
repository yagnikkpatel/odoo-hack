-- Phase 0 · BR-RBAC-1, BR-RBAC-3, BR-RBAC-4, BR-RBAC-5
-- Authorization is data, not code: 37 permission codes granted to roles at runtime.

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  module      TEXT NOT NULL CHECK (module IN
                ('employee','contract','attendance','time_off','payroll','config','admin')),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS permissions_module_idx ON permissions (module);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles (id)       ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx
  ON role_permissions (permission_id);

INSERT INTO permissions (code, module, description) VALUES
  ('employee.read_self',       'employee',   'View own employee record'),
  ('employee.read',            'employee',   'View all employee records'),
  ('employee.write',           'employee',   'Create and update employees'),
  ('employee.delete',          'employee',   'Terminate employees and archive org records'),
  ('contract.read',            'contract',   'View contracts'),
  ('contract.write',           'contract',   'Create, update and activate contracts'),
  ('contract.delete',          'contract',   'Delete draft contracts'),
  ('schedule.read',            'config',     'View working schedules'),
  ('schedule.write',           'config',     'Create and update working schedules'),
  ('attendance.read_self',     'attendance', 'View own attendance'),
  ('attendance.check_self',    'attendance', 'Check in and out'),
  ('attendance.read',          'attendance', 'View all attendance'),
  ('attendance.write',         'attendance', 'Create and correct attendance records'),
  ('attendance.delete',        'attendance', 'Delete attendance records'),
  ('time_off.read_self',       'time_off',   'View own time off and balances'),
  ('time_off.request_self',    'time_off',   'Submit and cancel own time off requests'),
  ('time_off.read',            'time_off',   'View all time off requests and allocations'),
  ('time_off.write',           'time_off',   'Create and update allocations and requests'),
  ('time_off.approve',         'time_off',   'Approve or refuse allocations and requests'),
  ('time_off_type.read',       'time_off',   'View time off types'),
  ('time_off_type.write',      'time_off',   'Create and update time off types'),
  ('payslip.read_self',        'payroll',    'View own payslips'),
  ('payrun.read',              'payroll',    'View payruns'),
  ('payrun.write',             'payroll',    'Create payruns and compute payslips'),
  ('payrun.validate',          'payroll',    'Validate and cancel payruns'),
  ('payrun.pay',               'payroll',    'Mark payruns paid'),
  ('payrun.send',              'payroll',    'Send payslips to employees'),
  ('payslip.read',             'payroll',    'View all payslips'),
  ('payslip.write',            'payroll',    'Recompute individual payslips'),
  ('salary_structure.read',    'payroll',    'View salary structures'),
  ('salary_structure.write',   'payroll',    'Create and update salary structures'),
  ('salary_rule.read',         'payroll',    'View salary rules'),
  ('salary_rule.write',        'payroll',    'Create and update salary rules'),
  ('dashboard.read',           'payroll',    'View the payroll dashboard'),
  ('config.write',             'config',     'Manage employment types and system configuration'),
  ('admin.user.manage',        'admin',      'Manage user accounts and role assignment'),
  ('admin.role.manage',        'admin',      'Manage the role permission matrix')
ON CONFLICT (code) DO UPDATE
  SET module = EXCLUDED.module, description = EXCLUDED.description;

-- Employee (6)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'employee' AND p.code IN (
  'employee.read_self','attendance.read_self','attendance.check_self',
  'time_off.read_self','time_off.request_self','payslip.read_self')
ON CONFLICT DO NOTHING;

-- HR Manager (22) = the six self codes + full HR CRUD. Deliberately no payroll codes (BR-RBAC-4).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'hr_manager' AND p.code IN (
  'employee.read_self','attendance.read_self','attendance.check_self',
  'time_off.read_self','time_off.request_self','payslip.read_self',
  'employee.read','employee.write','employee.delete',
  'contract.read','contract.write','contract.delete',
  'schedule.read','schedule.write',
  'attendance.read','attendance.write','attendance.delete',
  'time_off.read','time_off.write','time_off.approve',
  'time_off_type.read','time_off_type.write')
ON CONFLICT DO NOTHING;

-- HR Payroll User (29) = HR Manager + payrun/payslip CRUD + read-only salary config (BR-RBAC-5).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'hr_payroll_user' AND p.code IN (
  'employee.read_self','attendance.read_self','attendance.check_self',
  'time_off.read_self','time_off.request_self','payslip.read_self',
  'employee.read','employee.write','employee.delete',
  'contract.read','contract.write','contract.delete',
  'schedule.read','schedule.write',
  'attendance.read','attendance.write','attendance.delete',
  'time_off.read','time_off.write','time_off.approve',
  'time_off_type.read','time_off_type.write',
  'payrun.read','payrun.write','payslip.read','payslip.write',
  'salary_structure.read','salary_rule.read','dashboard.read')
ON CONFLICT DO NOTHING;

-- HR Payroll Manager (35) = everything except the two admin codes.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'hr_payroll_manager'
  AND p.code NOT IN ('admin.user.manage','admin.role.manage')
ON CONFLICT DO NOTHING;

-- Admin (37) = everything.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
