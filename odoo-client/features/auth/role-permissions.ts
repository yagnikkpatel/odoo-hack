import type { BackendRole } from './auth-types'
// Compatibility defaults matching the installed role grants. Verified session
// permissions take precedence, including an explicitly empty permission list.
const EMPLOYEE = [
  'attendance:create:own',
  'attendance:read:own',
  'employee:read:own',
  'time_off:create:own',
  'time_off:read:own',
] as const

const HR = [
  ...EMPLOYEE,
  'attendance:create:any',
  'attendance:delete',
  'attendance:read:any',
  'attendance:update:any',
  'contract:create',
  'contract:delete',
  'contract:read',
  'contract:update',
  'employee:create',
  'employee:delete',
  'employee:read:any',
  'employee:update:any',
  'payroll_dashboard:read',
  'time_off:approve',
  'time_off:create:any',
  'time_off:delete',
  'time_off:read:any',
  'time_off:update:any',
  'working_schedule:create',
  'working_schedule:delete',
  'working_schedule:read',
  'working_schedule:update',
] as const

const PAYROLL_USER = [
  ...HR,
  'payrun:create',
  'payrun:read',
  'payrun:update',
  'payslip:create',
  'payslip:read',
  'payslip:send',
  'payslip:update',
  'salary_rule:read',
  'salary_structure:read',
] as const

const PAYROLL_MANAGER = [
  ...PAYROLL_USER,
  'payrun:delete',
  'payslip:delete',
  'salary_rule:create',
  'salary_rule:delete',
  'salary_rule:update',
  'salary_structure:create',
  'salary_structure:delete',
  'salary_structure:update',
] as const

const ADMIN = [
  ...PAYROLL_MANAGER,
  'role:read',
  'role:update',
  'user:create',
  'user:delete',
  'user:read',
  'user:update',
] as const

export const DEFAULT_ROLE_PERMISSIONS: Record<BackendRole, readonly string[]> = {
  employee: EMPLOYEE,
  hr_manager: HR,
  hr_payroll_user: PAYROLL_USER,
  hr_payroll_manager: PAYROLL_MANAGER,
  admin: ADMIN,
}
