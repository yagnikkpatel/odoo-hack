'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Mirrors migration 007 for UI visibility; the backend enforces every request. */
export function employeePermissions(role: BackendRole) {
  if (role === 'employee') {
    return { canRead: true, canReadAll: false, canCreate: false, canUpdate: false, canDelete: false }
  }
  if (role === 'admin' || role === 'hr_manager' || role === 'hr_payroll_user' || role === 'hr_payroll_manager') {
    return { canRead: true, canReadAll: true, canCreate: true, canUpdate: true, canDelete: true }
  }
  return { canRead: false, canReadAll: false, canCreate: false, canUpdate: false, canDelete: false }
}

export function useEmployeePermissions() {
  const { user } = useCurrentUser()
  return employeePermissions(user.role)
}
