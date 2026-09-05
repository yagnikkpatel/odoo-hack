'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { SessionUser } from '../auth-types'
import { SessionUnavailable } from './session-unavailable'

const identity = (user: SessionUser) => [user.id, user.email, user.role, user.name || ''].join('\u0000')

/** Revalidate cached layouts after expiry or an account change in another tab. */
export function SessionGuard({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [unavailable, setUnavailable] = useState(false)
  const expectedIdentity = identity(user)
  useEffect(() => {
    let active: AbortController | null = null
    let disposed = false
    async function check() {
      if (active || document.visibilityState === 'hidden') return
      const controller = new AbortController()
      active = controller
      const timeout = setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
        if (disposed) return
        if (response.status === 401) {
          window.location.replace('/login')
          return
        }
        const payload = (await response.json().catch(() => null)) as { data?: { user?: SessionUser } } | null
        if (!response.ok || !payload?.data?.user) {
          setUnavailable(true)
          return
        }
        if (identity(payload.data.user) !== expectedIdentity) {
          window.location.reload()
          return
        }
        setUnavailable(false)
      } catch {
        if (!disposed) setUnavailable(true)
      } finally {
        clearTimeout(timeout)
        active = null
      }
    }
    void check()
    const timer = setInterval(check, 60000)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      disposed = true
      clearInterval(timer)
      active?.abort()
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [expectedIdentity])
  return unavailable ? <SessionUnavailable /> : children
}
