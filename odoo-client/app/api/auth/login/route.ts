import {
  applySessionCookies,
  authError,
  authJson,
  backendFailure,
  checkSameOrigin,
  parseAuthTokens,
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
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data))
      return backendFailure(502, 'login')
    const tokens = parseAuthTokens(payload.data)
    const reportedUser = parseSessionUser(payload.data.user)
    if (!tokens || !reportedUser || !tokenLifetime(tokens.accessToken)) return backendFailure(502, 'login')
    const user = await readVerifiedUser(tokens.accessToken)
    if (!user) return authError('The session could not be verified. Please sign in again.', 401)
    if (user.id !== reportedUser.id) return backendFailure(502, 'login')
    return applySessionCookies(authJson({ success: true }), tokens, input.rememberMe)
  } catch {
    return serviceUnavailable()
  }
}
