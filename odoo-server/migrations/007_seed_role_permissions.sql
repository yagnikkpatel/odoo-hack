INSERT INTO permissions (code, description) VALUES
  ('user:create', 'Create user accounts'),
  ('user:read', 'Read user accounts'),
  ('user:update', 'Update user accounts'),
  ('user:delete', 'Delete user accounts'),
  ('role:read', 'Read roles and permissions'),
  ('role:update', 'Assign roles and update permissions'),
  ('employee:create', 'Create employee records'),
  ('employee:read:own', 'Read own employee record'),
  ('employee:read:any', 'Read any employee record'),
  ('employee:update:any', 'Update any employee record'),
  ('employee:delete', 'Delete employee records'),
  ('attendance:create:own', 'Create own attendance entries'),
  ('attendance:create:any', 'Create attendance entries for any employee'),
  ('attendance:read:own', 'Read own attendance records'),
  ('attendance:read:any', 'Read any attendance records'),
  ('attendance:update:any', 'Update any attendance record'),
  ('attendance:delete', 'Delete attendance records'),
  ('contract:create', 'Create contracts'),
  ('contract:read', 'Read contracts'),
  ('contract:update', 'Update contracts'),
  ('contract:delete', 'Delete contracts'),
  ('working_schedule:create', 'Create working schedules'),
  ('working_schedule:read', 'Read working schedules'),
  ('working_schedule:update', 'Update working schedules'),
  ('working_schedule:delete', 'Delete working schedules'),
  ('time_off:create:own', 'Create own time off requests'),
  ('time_off:create:any', 'Create time off requests for any employee'),
  ('time_off:read:own', 'Read own time off requests and balances'),
  ('time_off:read:any', 'Read any time off requests and balances'),
  ('time_off:update:any', 'Update any time off request'),
  ('time_off:delete', 'Delete time off requests'),
  ('time_off:approve', 'Approve or refuse time off requests'),
  ('payrun:create', 'Create payruns'),
  ('payrun:read', 'Read payruns'),
  ('payrun:update', 'Update payruns'),
  ('payrun:delete', 'Delete payruns'),
  ('payslip:create', 'Create payslips'),
  ('payslip:read', 'Read payslips'),
  ('payslip:update', 'Update payslips'),
  ('payslip:delete', 'Delete payslips'),
  ('salary_structure:create', 'Create salary structures'),
  ('salary_structure:read', 'Read salary structures'),
  ('salary_structure:update', 'Update salary structures'),
  ('salary_structure:delete', 'Delete salary structures'),
  ('salary_rule:create', 'Create salary rules'),
  ('salary_rule:read', 'Read salary rules'),
  ('salary_rule:update', 'Update salary rules'),
  ('salary_rule:delete', 'Delete salary rules')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'employee:read:own',
  'attendance:create:own',
  'attendance:read:own',
  'time_off:create:own',
  'time_off:read:own'
])
WHERE r.name = 'employee'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'employee:create',
  'employee:read:own',
  'employee:read:any',
  'employee:update:any',
  'employee:delete',
  'attendance:create:own',
  'attendance:create:any',
  'attendance:read:own',
  'attendance:read:any',
  'attendance:update:any',
  'attendance:delete',
  'contract:create',
  'contract:read',
  'contract:update',
  'contract:delete',
  'working_schedule:create',
  'working_schedule:read',
  'working_schedule:update',
  'working_schedule:delete',
  'time_off:create:own',
  'time_off:create:any',
  'time_off:read:own',
  'time_off:read:any',
  'time_off:update:any',
  'time_off:delete',
  'time_off:approve'
])
WHERE r.name = 'hr_manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT target.id, rp.permission_id
FROM roles target
JOIN roles source ON source.name = 'hr_manager'
JOIN role_permissions rp ON rp.role_id = source.id
WHERE target.name = 'hr_payroll_user'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'payrun:create',
  'payrun:read',
  'payrun:update',
  'payslip:create',
  'payslip:read',
  'payslip:update',
  'salary_structure:read',
  'salary_rule:read'
])
WHERE r.name = 'hr_payroll_user'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT target.id, rp.permission_id
FROM roles target
JOIN roles source ON source.name = 'hr_payroll_user'
JOIN role_permissions rp ON rp.role_id = source.id
WHERE target.name = 'hr_payroll_manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = ANY(ARRAY[
  'payrun:delete',
  'payslip:delete',
  'salary_structure:create',
  'salary_structure:update',
  'salary_structure:delete',
  'salary_rule:create',
  'salary_rule:update',
  'salary_rule:delete'
])
WHERE r.name = 'hr_payroll_manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
