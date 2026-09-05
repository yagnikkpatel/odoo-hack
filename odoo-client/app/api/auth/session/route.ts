import { cookies } from 'next/headers'
import { getSession } from '@/features/auth/session'
import {
  applySessionCookies,
  authError,
  authJson,
  clearSessionCookies,
  readVerifiedUser,
  requestTokenRefresh,
  serviceUnavailable
} from '@/features/auth/auth-server'
import { PERSISTENT_SESSION_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/features/auth/auth-constants'

export async function GET() {
  try {
    const user = await getSession()
    if (user) return authJson({ success: true, data: { user } })

    // The access token is gone or expired: spend the refresh token before
    // sending the visitor back to the sign-in screen.
    const store = await cookies()
    const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value
    if (refreshToken) {
      const tokens = await requestTokenRefresh(refreshToken)
      const refreshedUser = tokens && (await readVerifiedUser(tokens.accessToken))
      if (tokens && refreshedUser)
        return applySessionCookies(
          authJson({ success: true, data: { user: refreshedUser } }),
          tokens,
          store.get(PERSISTENT_SESSION_COOKIE_NAME)?.value === '1'
        )
    }
    return clearSessionCookies(authError('Sign in to continue.', 401))
  } catch {
    return serviceUnavailable()
  }
}
