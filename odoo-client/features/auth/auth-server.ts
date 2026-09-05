import 'server-only'

import { NextResponse } from 'next/server'
import { getBackendApiEndpoint } from '@/lib/backend-api'
import { AUTH_REQUEST_TIMEOUT_MS } from './auth-constants'
import { isRecord, parseSessionUser } from './auth-validation'
import type { SessionUser } from './auth-types'

export class AuthServiceUnavailableError extends Error {
  constructor() {
    super('The authentication service is currently unavailable. Please try again shortly.')
    this.name = 'AuthServiceUnavailableError'
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
}

export function authJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } })
}
export function authError(message: string, status: number) {
  return authJson({ success: false, message }, status)
}

// Browser fetch supplies Origin for POST. Reject absent and cross-site origins.
export function checkSameOrigin(request: Request) {
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return authError('This request must originate from this application.', 403)
  }
  return null
}

export async function readAuthBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  if (Number(request.headers.get('content-length')) > 16_384) return null
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > 16_384) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export async function requestAuthBackend(path: string, input?: unknown, token?: string) {
  try {
    const response = await fetch(getBackendApiEndpoint(`/auth/${path}`), {
      method: input === undefined ? 'GET' : 'POST',
      headers: {
        Accept: 'application/json',
        ...(input === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS)
    })
    const payload: unknown = await response.json().catch(() => null)
    return { response, payload }
  } catch {
    throw new AuthServiceUnavailableError()
  }
}

export function backendFailure(status: number, operation: 'login' | 'recovery') {
  if (status === 429) return authError('Too many attempts. Please wait before trying again.', 429)
  if (operation === 'login' && status === 401) return authError('Invalid email or password.', 401)
  if (operation === 'login' && status === 403)
    return authError('This account is inactive. Contact your administrator.', 403)
  if (operation === 'recovery' && [400, 401, 403, 404, 422].includes(status)) {
    return authError('The recovery details are invalid or expired. Please check them or request a new code.', 400)
  }
  // Unexpected backend errors can contain internal details: never forward them.
  return authError('The authentication service returned an unexpected response. Please try again.', 502)
}
export function serviceUnavailable() {
  return authError(new AuthServiceUnavailableError().message, 503)
}

export async function readVerifiedUser(token: string): Promise<SessionUser | null> {
  const { response, payload } = await requestAuthBackend('me', undefined, token)
  if (response.status === 401 || response.status === 403) return null
  if (!response.ok || !isRecord(payload) || payload.success !== true || !isRecord(payload.data))
    throw new AuthServiceUnavailableError()
  const user = parseSessionUser(payload.data.user)
  if (!user) throw new AuthServiceUnavailableError()
  return user
}

// Decode ONLY expiry to bound cookie lifetime, never to authenticate identity.
// Identity is verified by the backend's authenticated /auth/me on each request.
export function tokenLifetime(token: string, now = Date.now()): number | null {
  if (token.length > 3800 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    if (!isRecord(payload) || typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp)) return null
    const seconds = Math.floor(payload.exp - now / 1000)
    return seconds > 0 ? seconds : null
  } catch {
    return null
  }
}
