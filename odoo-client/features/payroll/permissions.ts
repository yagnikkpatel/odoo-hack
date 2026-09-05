'use client'

import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import type { BackendRole } from '@/features/auth/auth-types'

/**
 * Mirrors the API permission grants: payroll users process payruns and read
 * configuration, payroll managers and admins also configure and delete, HR
 * managers only see the dashboard.
 */
export function payrollPermissions(role: BackendRole | string) {
  const canRead = ['admin', 'hr_payroll_manager', 'hr_payroll_user'].includes(role)
  const canConfigure = ['admin', 'hr_payroll_manager'].includes(role)
  return {
    role,
    canRead,
    canProcess: canRead,
    canConfigure,
    canDelete: canConfigure,
    canReport: canRead || role === 'hr_manager'
  }
}
export function usePayrollPermissions() {
  return payrollPermissions(useCurrentUser().user.role)
}
