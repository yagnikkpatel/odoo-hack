import { SESSION_COOKIE_NAME, PASSWORD_RESET_COOKIE_NAME } from '@/features/auth/auth-constants'
import { authJson, checkSameOrigin, cookieOptions } from '@/features/auth/auth-server'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  const response = authJson({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
  response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
  return response
}
