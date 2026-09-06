'use client'

import { useEffect, useState } from 'react'
import { useEmployee, useEmployeesStore } from '../store'
import { useEmployeePermissions } from '../permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

type RecordRequest = {
  id: string | null
  attempt: number
  error: string | null
}

/** Fetch direct links independently from the paginated employee directory. */
export function useEmployeeRecord(id: string | null) {
  const { user } = useCurrentUser()
  const { canRead, canReadAll } = useEmployeePermissions()
  const allowed = canRead && (canReadAll || id === user.id)
  const cached = useEmployee(id || undefined)
  const employee = allowed ? cached : undefined
  const loadEmployee = useEmployeesStore((state) => state.loadEmployee)
  const [attempt, setAttempt] = useState(0)
  const [request, setRequest] = useState<RecordRequest>({
    id: null,
    attempt: -1,
    error: null,
  })

  useEffect(() => {
    if (!id || !allowed) return
    let active = true
    void loadEmployee(id).then(
      () => {
        if (active) setRequest({ id, attempt, error: null })
      },
      (cause: unknown) => {
        let error = 'The employee could not be loaded. Please try again.'
        if (cause instanceof Error) error = cause.message
        if (active) setRequest({ id, attempt, error })
      },
    )
    return () => {
      active = false
    }
  }, [id, attempt, loadEmployee, allowed])

  const completed = request.id === id && request.attempt === attempt
  let error: string | null = null
  if (!allowed && id) error = 'You do not have access to this employee profile.'
  else if (completed) error = request.error

  return {
    employee,
    isLoading: Boolean(id) && allowed && !completed,
    error,
    retry: () => setAttempt((value) => value + 1),
  }
}
