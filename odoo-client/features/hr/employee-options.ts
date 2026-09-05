'use client'

import { useCallback, useEffect, useState } from 'react'
import { listEmployeeOptions, listEmployees } from '@/features/employees/service'

export type EmployeeOption = { id: string; name: string; email: string }

// Kept in sync by listEmployeeDirectory() so render-time code that cannot await
// (e.g. a Zustand store's synchronous preview selector) can still read the
// latest known ids. Empty until the first directory load resolves.
let cachedDirectory: EmployeeOption[] = []

export function getCachedEmployeeIds(): string[] {
  return cachedDirectory.map(employee => employee.id)
}

/**
 * Every employee that can own an HR record, for a picker.
 *
 * The employees store is only hydrated by the employee directory table, so any
 * other module needs its own source. Accounts and profiles are merged because
 * either can exist without the other, and both are addressable by user id.
 */
export async function listEmployeeDirectory(): Promise<EmployeeOption[]> {
  const accounts = await listEmployeeOptions('accounts')
  const employees = new Map<string, EmployeeOption>()
  for (const account of accounts) employees.set(account.id, account)
  let offset = 0
  while (true) {
    const result = await listEmployees({ limit: 100, offset })
    for (const employee of result.employees) {
      employees.set(employee.id, {
        id: employee.id,
        name: employee.name || `${employee.firstName} ${employee.lastName}`.trim(),
        email: employee.email
      })
    }
    if (!result.pagination.hasMore || !result.employees.length) break
    offset += result.employees.length
  }
  const directory = [...employees.values()].sort((first, second) => first.name.localeCompare(second.name))
  cachedDirectory = directory
  return directory
}

/** Loads the directory once per mount, with a retry for the caller to surface. */
export function useEmployeeOptions() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    listEmployeeDirectory()
      .then(result => {
        if (!active) return
        setEmployees(result)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Unable to load employees.')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt(count => count + 1), [])

  return { employees, loading, error, reload }
}
