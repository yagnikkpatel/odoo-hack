import { getSession } from '@/features/auth/session'
import { authError, authJson, cookieOptions, serviceUnavailable } from '@/features/auth/auth-server'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'

export async function GET() {
  try {
    const user = await getSession()
    if (user) return authJson({ success: true, data: { user } })
    const response = authError('Sign in to continue.', 401)
    response.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
    return response
  } catch {
    return serviceUnavailable()
  }
}
