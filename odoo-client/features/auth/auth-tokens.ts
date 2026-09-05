// Runtime-agnostic token helpers: imported by route handlers AND by the
// middleware, so nothing here may depend on `server-only` or Node-only APIs.
import { getBackendApiEndpoint } from '@/lib/backend-api-url'
import { AUTH_REQUEST_TIMEOUT_MS } from './auth-constants'
import { isRecord } from './auth-validation'

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  refreshExpiresInSeconds: number
}

const MAX_TOKEN_LENGTH = 3800

export function parseAuthTokens(value: unknown): AuthTokens | null {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== 'string' ||
    typeof value.refreshToken !== 'string' ||
    !value.accessToken ||
    !value.refreshToken ||
    value.accessToken.length > MAX_TOKEN_LENGTH ||
    value.refreshToken.length > MAX_TOKEN_LENGTH ||
    typeof value.refreshExpiresInSeconds !== 'number' ||
    !Number.isSafeInteger(value.refreshExpiresInSeconds) ||
    value.refreshExpiresInSeconds <= 0
  )
    return null
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    refreshExpiresInSeconds: value.refreshExpiresInSeconds
  }
}

// Exchanges a refresh token for a fresh pair. Returns null when the refresh
// token is rejected (expired, rotated away, revoked) or the backend is down —
// the caller then treats the visitor as signed out.
export async function requestTokenRefresh(refreshToken: string): Promise<AuthTokens | null> {
  if (!refreshToken || refreshToken.length > MAX_TOKEN_LENGTH) return null
  try {
    const response = await fetch(getBackendApiEndpoint('/auth/refresh'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const payload: unknown = await response.json().catch(() => null)
    if (!isRecord(payload) || payload.success !== true) return null
    return parseAuthTokens(payload.data)
  } catch {
    return null
  }
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=')
  // `atob` rather than `Buffer`: this module also runs in the middleware runtime.
  return atob(base64)
}

// Decode ONLY expiry to bound cookie lifetime, never to authenticate identity.
// Identity is verified by the backend's authenticated /auth/me on each request.
export function tokenLifetime(token: string, now = Date.now()): number | null {
  if (token.length > MAX_TOKEN_LENGTH || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(token.split('.')[1]))
    if (!isRecord(payload) || typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp)) return null
    const seconds = Math.floor(payload.exp - now / 1000)
    return seconds > 0 ? seconds : null
  } catch {
    return null
  }
}
