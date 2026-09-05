import { cookies } from 'next/headers'
import { PASSWORD_RESET_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
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
import { isRecord, parsePasswordResetInput } from '@/features/auth/auth-validation'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  const input = parsePasswordResetInput(await readAuthBody(request))
  if (!input) return authError('Use matching passwords between 8 and 72 characters.', 400)
  const resetToken = (await cookies()).get(PASSWORD_RESET_COOKIE_NAME)?.value
  if (!resetToken || !/^[a-f0-9]{64}$/i.test(resetToken))
    return authError('Verify a recovery code before resetting your password.', 401)
  try {
    const { response: upstream, payload } = await requestAuthBackend('reset-password', { ...input, resetToken })
    if (!upstream.ok) {
      const response = backendFailure(upstream.status, 'recovery')
      if ([400, 401, 403, 404].includes(upstream.status))
        response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
      return response
    }
    if (!isRecord(payload) || payload.success !== true) return backendFailure(502, 'recovery')
    const response = authJson({
      success: true,
      message: 'Your password has been reset. Sign in with your new password.'
    })
    response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
    response.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
    return response
  } catch {
    return serviceUnavailable()
  }
}
