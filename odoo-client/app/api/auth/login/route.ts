import { SESSION_COOKIE_NAME, PASSWORD_RESET_COOKIE_NAME } from '@/features/auth/auth-constants'
import {
  authError,
  authJson,
  backendFailure,
  checkSameOrigin,
  cookieOptions,
  readAuthBody,
  readVerifiedUser,
  requestAuthBackend,
  serviceUnavailable,
  tokenLifetime
} from '@/features/auth/auth-server'
import { isRecord, parseLoginInput, parseSessionUser } from '@/features/auth/auth-validation'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  const input = parseLoginInput(await readAuthBody(request))
  if (!input) return authError('Enter a valid email and password.', 400)
  try {
    const { response: upstream, payload } = await requestAuthBackend('login', {
      email: input.email,
      password: input.password
    })
    if (!upstream.ok) return backendFailure(upstream.status, 'login')
    if (
      !isRecord(payload) ||
      payload.success !== true ||
      !isRecord(payload.data) ||
      typeof payload.data.accessToken !== 'string'
    )
      return backendFailure(502, 'login')
    const reportedUser = parseSessionUser(payload.data.user)
    const token = payload.data.accessToken
    if (!reportedUser || !tokenLifetime(token)) return backendFailure(502, 'login')
    const user = await readVerifiedUser(token)
    if (!user) return authError('The session could not be verified. Please sign in again.', 401)
    if (user.id !== reportedUser.id) return backendFailure(502, 'login')
    const maxAge = tokenLifetime(token)
    if (!maxAge) return authError('The session expired. Please sign in again.', 401)
    const response = authJson({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, ...(input.rememberMe ? { maxAge } : {}) })
    response.cookies.set(PASSWORD_RESET_COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 })
    return response
  } catch {
    return serviceUnavailable()
  }
}
