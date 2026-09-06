'use client'

import type { BackendRole } from '@/features/auth/auth-types'
import { attendanceAccess } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

/** Role defaults support callers without a session; hooks use the API's grants. */
export function attendancePermissions(role: BackendRole) {
  return attendanceAccess({ role })
}

export function useAttendancePermissions() {
  return attendanceAccess(useCurrentUser().user)
}
