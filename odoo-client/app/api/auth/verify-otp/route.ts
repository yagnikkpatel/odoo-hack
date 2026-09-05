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
  if (!email || !isRecord(body) || typeof body.otp !== 'string' || !/^[0-9]{6}$/.test(body.otp)) {
    return authError('Enter your email and the six-digit recovery code.', 400)
  }
  try {
    const { response: upstream, payload } = await requestAuthBackend('verify-otp', { email, otp: body.otp })
    if (!upstream.ok) return backendFailure(upstream.status, 'recovery')
    if (
      !isRecord(payload) ||
      payload.success !== true ||
      !isRecord(payload.data) ||
      typeof payload.data.resetToken !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(payload.data.resetToken) ||
      typeof payload.data.expiresInSeconds !== 'number' ||
      !Number.isSafeInteger(payload.data.expiresInSeconds) ||
      payload.data.expiresInSeconds <= 0
    ) {
      return backendFailure(502, 'recovery')
    }
    const response = authJson({ success: true })
    response.cookies.set(PASSWORD_RESET_COOKIE_NAME, payload.data.resetToken, {
      ...cookieOptions,
      maxAge: Math.min(payload.data.expiresInSeconds, 600)
    })
    return response
  } catch {
    return serviceUnavailable()
  }
}
