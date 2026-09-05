'use client'

import { useEffect, useRef } from 'react'
import { usePayrollStore } from '../store'

/** Loads the payroll snapshot once per mount (strict-mode safe via the ref). */
export default function usePayrollData() {
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    usePayrollStore
      .getState()
      .load()
      .catch(() => {})
  }, [])
}
