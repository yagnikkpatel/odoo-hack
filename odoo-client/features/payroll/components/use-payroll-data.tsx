"use client"

import { useEffect, useRef } from 'react'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { usePayrollStore } from '../store'
import { Button } from '@/features/nexacrm/components/ui/button'

/** Same mount-to-store load flow as 961f701, keyed to the verified account. */
export default function usePayrollData() {
  const { user } = useCurrentUser()
  const store = usePayrollStore(state => state)
  const requested = useRef('')
  useEffect(() => {
    const key = JSON.stringify(user)
    if (requested.current === key) return
    requested.current = key
    void usePayrollStore.getState().load(user, true)
  }, [user])
  const matches = store.ownerKey === JSON.stringify(user)
  return {
    isLoading: !matches || !store.hasHydrated || store.isLoading,
    error: matches ? store.error : null,
    retry: () => { void usePayrollStore.getState().load(user, true) },
  }
}

export function PayrollDataStatus({ state }: { state: ReturnType<typeof usePayrollData> }) {
  if (state.error) return <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm"><p>{state.error}</p><Button size="sm" variant="outline" onClick={state.retry}>Retry</Button></div>
  if (state.isLoading) return <p role="status" className="py-8 text-sm text-muted-foreground">Loading payroll…</p>
  return null
}
