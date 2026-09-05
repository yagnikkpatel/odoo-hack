// Runtime-agnostic cookie helpers: used by the auth route handlers AND by the
// middleware, so nothing here may depend on `server-only`.
import type { NextResponse } from 'next/server'
import {
  PASSWORD_RESET_COOKIE_NAME,
  PERSISTENT_SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME
} from './auth-constants'
import { tokenLifetime, type AuthTokens } from './auth-tokens'

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
}

// Writes the freshly issued pair. `persistent` mirrors "remember me": when
// false the cookies are browser-session scoped and vanish on close.
export function applySessionCookies(response: NextResponse, tokens: AuthTokens, persistent: boolean) {
  const accessMaxAge = tokenLifetime(tokens.accessToken)
  response.cookies.set(SESSION_COOKIE_NAME, tokens.accessToken, {
    ...cookieOptions,
    ...(persistent && accessMaxAge ? { maxAge: accessMaxAge } : {})
  })
  response.cookies.set(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...cookieOptions,
    ...(persistent ? { maxAge: tokens.refreshExpiresInSeconds } : {})
  })
  response.cookies.set(PERSISTENT_SESSION_COOKIE_NAME, persistent ? '1' : '', {
    ...cookieOptions,
    ...(persistent ? { maxAge: tokens.refreshExpiresInSeconds } : { maxAge: 0 })
  })
  return response
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [
    SESSION_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    PERSISTENT_SESSION_COOKIE_NAME,
    PASSWORD_RESET_COOKIE_NAME
  ]) {
    response.cookies.set(name, '', { ...cookieOptions, maxAge: 0 })
  }
  return response
}
