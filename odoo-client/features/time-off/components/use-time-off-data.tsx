'use client'

import { useEffect, useRef } from 'react'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'

/**
 * Loads the time off snapshot once per mount.
 *
 * The ref survives React strict mode's effect double-invocation — strict mode re-runs the
 * effect on the same component instance, so the ref is still `true` the second time and only
 * one request is issued. A genuine remount gets a fresh ref and therefore a fresh snapshot.
 *
 * Scope follows the viewer's permissions: an employee without `time_off:read:any` only has
 * `time_off:read:own`, so the any-scope snapshot endpoint would 403 for them.
 */
export default function useTimeOffData() {
  const { canReadAny, canReadOwn } = useTimeOffPermissions()
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current || (!canReadAny && !canReadOwn)) return
    requested.current = true
    useTimeOffStore
      .getState()
      .load(canReadAny ? 'any' : 'own')
      .catch(() => {
        // The store records the failure in its `error` field; the UI surfaces it from there.
      })
  }, [canReadAny, canReadOwn])
}
