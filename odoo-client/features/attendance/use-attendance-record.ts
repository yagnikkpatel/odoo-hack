'use client'

import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useAttendancePermissions } from './permissions'
import { useAttendanceStore } from './store'

export function useAttendanceRecord(id: string | null) {
  const { user } = useCurrentUser()
  const { canReadAny, canReadOwn } = useAttendancePermissions()
  const allowed = canReadAny || canReadOwn
  const scope = canReadAny ? 'all' : 'own'
  const cached = useAttendanceStore((state) =>
    id
      ? state.details[id] || state.records.find((item) => item.id === id)
      : undefined,
  )
  const record =
    allowed && cached && (canReadAny || cached.employeeId === user.id) ? cached : undefined
  const loadRecord = useAttendanceStore((state) => state.loadRecord)
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<{
    id: string
    message: string
  } | null>(null)

  useEffect(() => {
    if (!id || record || !allowed) return
    let active = true
    void loadRecord(id, scope).catch((cause) => {
      if (active)
        setFailure({
          id,
          message:
            cause instanceof Error
              ? cause.message
              : 'Attendance could not be loaded.',
        })
    })
    return () => {
      active = false
    }
  }, [id, record, loadRecord, scope, attempt, allowed])

  const error = !allowed ? 'You do not have access to attendance.' : failure?.id === id && !record ? failure.message : null
  function retry() {
    setFailure(null)
    setAttempt((value) => value + 1)
  }
  return { record, loading: Boolean(id && !record && !error), error, retry }
}
