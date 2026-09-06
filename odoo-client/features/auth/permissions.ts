import type { BackendRole } from './auth-types'
import { DEFAULT_ROLE_PERMISSIONS } from './role-permissions'

/** UI visibility only. Every API continues to enforce its own authorization. */
export type Actor = { role: string; permissions?: readonly string[] }

export function rolePermissions(role: string): readonly string[] {
  return Object.hasOwn(DEFAULT_ROLE_PERMISSIONS, role)
    ? DEFAULT_ROLE_PERMISSIONS[role as BackendRole]
    : []
}

export function hasPermission(actor: Actor, code: string) {
  return (actor.permissions ?? rolePermissions(actor.role)).includes(code)
}
const has = hasPermission
const hasAny = (actor: Actor, ...codes: string[]) => codes.some(code => has(actor, code))

export function employeeAccess(actor: Actor) {
  return {
    canRead: hasAny(actor, 'employee:read:any', 'employee:read:own'),
    canReadAll: has(actor, 'employee:read:any'),
    canCreate: has(actor, 'employee:create'),
    canUpdate: has(actor, 'employee:update:any'),
    canDelete: has(actor, 'employee:delete'),
    canManageAccounts: has(actor, 'user:create'),
  }
}

export function attendanceAccess(actor: Actor) {
  return {
    canReadOwn: hasAny(actor, 'attendance:read:own', 'attendance:read:any'),
    canCheckIn: has(actor, 'attendance:create:own'),
    canReadAny: has(actor, 'attendance:read:any'),
    canCreate: has(actor, 'attendance:create:any'),
    canUpdate: has(actor, 'attendance:update:any'),
    canDelete: has(actor, 'attendance:delete'),
  }
}

export function timeOffAccess(actor: Actor) {
  return {
    canReadOwn: hasAny(actor, 'time_off:read:own', 'time_off:read:any'),
    canReadAny: has(actor, 'time_off:read:any'),
    canReadTypes: has(actor, 'time_off:read:any'),
    canReadAllocations: has(actor, 'time_off:read:any'),
    canCreateOwn: has(actor, 'time_off:create:own'),
    canCreateAny: has(actor, 'time_off:create:any'),
    canUpdate: has(actor, 'time_off:update:any'),
    canDelete: has(actor, 'time_off:delete'),
    canApprove: has(actor, 'time_off:approve'),
    canManageTypes: has(actor, 'time_off:update:any'),
    canCreateTypes: has(actor, 'time_off:update:any'),
    canDeleteTypes: has(actor, 'time_off:delete'),
  }
}

export function contractAccess(actor: Actor) {
  return {
    canRead: has(actor, 'contract:read'),
    canCreate: has(actor, 'contract:create'),
    canUpdate: has(actor, 'contract:update'),
    canDelete: has(actor, 'contract:delete'),
  }
}

export function payrollAccess(actor: Actor) {
  const canReadPayruns = has(actor, 'payrun:read')
  const canReadPayslips = has(actor, 'payslip:read')
  const canConfigureRules = has(actor, 'salary_rule:update')
  const canConfigureStructures = has(actor, 'salary_structure:update')
  const canDeletePayrun = has(actor, 'payrun:delete')
  const canDeletePayslip = has(actor, 'payslip:delete')
  return {
    role: actor.role,
    canRead: canReadPayruns || canReadPayslips,
    canReadPayruns,
    canReadPayslips,
    canReadRules: has(actor, 'salary_rule:read'),
    canReadStructures: has(actor, 'salary_structure:read'),
    canCreatePayrun: has(actor, 'payrun:create'),
    canProcess: has(actor, 'payrun:update') && has(actor, 'payslip:create'),
    canUpdatePayrun: has(actor, 'payrun:update'),
    canCompute: has(actor, 'payslip:create'),
    canUpdateBank: has(actor, 'payslip:update'),
    canConfigure: canConfigureRules || canConfigureStructures,
    canConfigureRules,
    canConfigureStructures,
    canCreateRules: has(actor, 'salary_rule:create'),
    canCreateStructures: has(actor, 'salary_structure:create'),
    canDelete: canDeletePayrun || canDeletePayslip,
    canDeletePayrun,
    canDeletePayslip,
    canDeleteRules: has(actor, 'salary_rule:delete'),
    canDeleteStructures: has(actor, 'salary_structure:delete'),
    canSend: has(actor, 'payslip:send'),
    // The installed dashboard endpoint requires payslip:read, not the older
    // payroll_dashboard:read grant. Visibility follows the working endpoint.
    canReport: canReadPayslips,
  }
}

export function moduleAccess(actor: Actor) {
  return {
    employees: employeeAccess(actor),
    attendance: attendanceAccess(actor),
    timeOff: timeOffAccess(actor),
    contracts: contractAccess(actor),
    payroll: payrollAccess(actor),
  }
}
