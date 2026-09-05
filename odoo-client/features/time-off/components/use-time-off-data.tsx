'use client'

import { useEffect, useRef } from 'react'
import { useTimeOffStore } from '../store'

/**
 * Loads the time off snapshot once per mount.
 *
 * The ref survives React strict mode's effect double-invocation — strict mode re-runs the
 * effect on the same component instance, so the ref is still `true` the second time and only
 * one request is issued. A genuine remount gets a fresh ref and therefore a fresh snapshot.
 */
export default function useTimeOffData() {
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    useTimeOffStore
      .getState()
      .load()
      .catch(() => {
        // The store records the failure in its `error` field; the UI surfaces it from there.
      })
  }, [])
}
