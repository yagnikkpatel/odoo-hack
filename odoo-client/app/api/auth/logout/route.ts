import { cookies } from 'next/headers'
import { REFRESH_COOKIE_NAME } from '@/features/auth/auth-constants'
import {
  authJson,
  checkSameOrigin,
  clearSessionCookies,
  requestAuthBackend
} from '@/features/auth/auth-server'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  const refreshToken = (await cookies()).get(REFRESH_COOKIE_NAME)?.value
  // Revoke the session server-side so the refresh token cannot outlive the
  // cookie. A failure here must still sign the visitor out locally.
  if (refreshToken) await requestAuthBackend('logout', { refreshToken }).catch(() => null)
  return clearSessionCookies(authJson({ success: true }))
}
