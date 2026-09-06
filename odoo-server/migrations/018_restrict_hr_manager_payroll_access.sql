-- HR Manager is an HR role, not a payroll one: it owns employees, attendance,
-- contracts, working schedules and time off, and approves leave, but payroll is
-- none of its business.
--
-- 016 gave it payrun:read and payslip:read so the payroll dashboard would load
-- for it. That was the wrong call -- salary figures are exactly what the role is
-- meant not to see -- so the grant is withdrawn here. Payroll reporting belongs
-- to the payroll roles and to admin.
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'hr_manager'
  AND p.code IN ('payrun:read', 'payslip:read');
