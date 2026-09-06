'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { employeeAccess } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Role defaults support callers without a session; hooks use the API's grants. */
export function employeePermissions(role: BackendRole) {
  return employeeAccess({ role })
}

export function useEmployeePermissions() {
  return employeeAccess(useCurrentUser().user)
}
