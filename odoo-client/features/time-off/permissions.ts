'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Mirrors migration 007; the API enforces permissions.
export function timeOffPermissions(role: BackendRole) {
  const own = [
    'employee', 'admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager',
  ].includes(role)
  const manage = own && role !== 'employee'
  return {
    canReadOwn: own,
    canReadAny: manage,
    canCreateOwn: own,
    canCreateAny: manage,
    canUpdate: manage,
    canDelete: manage,
    canApprove: manage,
    canManageTypes: manage,
  }
}

export function useTimeOffPermissions() {
  return timeOffPermissions(useCurrentUser().user.role)
}
