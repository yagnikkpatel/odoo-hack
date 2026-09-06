import type { SessionUser } from './auth-types'

/**
 * What the signed-in account may do, derived from the permission codes the API
 * grants it rather than from its role name. The API is still the authorization
 * boundary -- this only decides what the interface offers, and stays in step
 * with the database because both read the same codes.
 */
export type Actor = Pick<SessionUser, 'role' | 'permissions'>

const has = (actor: Actor, code: string) => actor.permissions.includes(code)
const hasAny = (actor: Actor, ...codes: string[]) => codes.some(code => has(actor, code))

export function employeeAccess(actor: Actor) {
  return {
    canRead: hasAny(actor, 'employee:read:any', 'employee:read:own'),
    canReadAll: has(actor, 'employee:read:any'),
    canCreate: has(actor, 'employee:create'),
    canUpdate: has(actor, 'employee:update:any'),
    canDelete: has(actor, 'employee:delete'),
    /** Only an administrator creates login accounts and assigns roles. */
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
    canCreateOwn: has(actor, 'time_off:create:own'),
    canCreateAny: has(actor, 'time_off:create:any'),
    canUpdate: has(actor, 'time_off:update:any'),
    canDelete: has(actor, 'time_off:delete'),
    canApprove: has(actor, 'time_off:approve'),
    canManageTypes: has(actor, 'time_off:update:any'),
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
  const canRead = hasAny(actor, 'payrun:read', 'payslip:read')
  return {
    role: actor.role,
    canRead,
    /** Compute writes payslips; validating and marking paid write the payrun. */
    canProcess: has(actor, 'payrun:update') && has(actor, 'payslip:create'),
    /** Salary structures and rules are read-only for a payroll user. */
    canConfigure: hasAny(actor, 'salary_structure:update', 'salary_rule:update'),
    canDelete: hasAny(actor, 'payrun:delete', 'payslip:delete'),
    canSend: has(actor, 'payslip:send'),
    canReport: canRead,
  }
}

/** Every module gate in one place, for navigation and page guards. */
export function moduleAccess(actor: Actor) {
  return {
    employees: employeeAccess(actor),
    attendance: attendanceAccess(actor),
    timeOff: timeOffAccess(actor),
    contracts: contractAccess(actor),
    payroll: payrollAccess(actor),
  }
}
