'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { contractAccess } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Role defaults support callers without a session; hooks use the API's grants. */
export function contractPermissions(role: BackendRole) {
  return contractAccess({ role })
}

export function useContractPermissions() {
  return contractAccess(useCurrentUser().user)
}
