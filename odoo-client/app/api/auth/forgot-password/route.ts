import { PASSWORD_RESET_COOKIE_NAME } from '@/features/auth/auth-constants'
import {
  authError,
  authJson,
  backendFailure,
  checkSameOrigin,
  cookieOptions,
  readAuthBody,
  requestAuthBackend,
  serviceUnavailable
} from '@/features/auth/auth-server'
import { isRecord, parseEmail } from '@/features/auth/auth-validation'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  const body = await readAuthBody(request)
  const email = isRecord(body) ? parseEmail(body.email) : null
  if (!email) return authError('Enter a valid email address.', 400)
  try {
    const { response: upstream, payload } = await requestAuthBackend('forgot-password', { email })
    if (!upstream.ok) return backendFailure(upstream.status, 'recovery')
    if (!isRecord(payload) || payload.success !== true) return backendFailure(502, 'recovery')
    const response = authJson({
      success: true,
      message: 'If this account exists, a recovery code has been emailed to that address.'
    })
    response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
    return response
  } catch {
    return serviceUnavailable()
  }
}
