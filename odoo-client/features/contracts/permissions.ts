'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Mirrors backend migration 007 for visibility; the backend enforces requests. */
export function contractPermissions(role: BackendRole) {
  const allowed =
    role === 'admin' ||
    role === 'hr_manager' ||
    role === 'hr_payroll_user' ||
    role === 'hr_payroll_manager'
  return {
    canRead: allowed,
    canCreate: allowed,
    canUpdate: allowed,
    canDelete: allowed,
  }
}

export function useContractPermissions() {
  const { user } = useCurrentUser()
  return contractPermissions(user.role)
}
