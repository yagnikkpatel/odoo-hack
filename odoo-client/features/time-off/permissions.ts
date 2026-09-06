'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { timeOffAccess } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Role defaults support callers without a session; hooks use the API's grants. */
export function timeOffPermissions(role: BackendRole) {
  return timeOffAccess({ role })
}

export function useTimeOffPermissions() {
  return timeOffAccess(useCurrentUser().user)
}
