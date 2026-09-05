import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
import { authError, authJson, checkSameOrigin, readAuthBody, readVerifiedUser } from '@/features/auth/auth-server'
import { isRecord } from '@/features/auth/auth-validation'
import { getBackendApiEndpoint } from '@/lib/backend-api'
import { parseCreateUserInput, parseCreatedUser } from '@/features/users/validation'

export async function POST(request: Request) {
  const rejected = checkSameOrigin(request)
  if (rejected) return rejected
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    if (!token) return authError('Sign in to create an account.', 401)
    const actor = await readVerifiedUser(token)
    if (!actor) return authError('Your session has expired. Sign in again.', 401)
    if (actor.role !== 'admin') return authError('Only an administrator can create login accounts.', 403)

    const input = parseCreateUserInput(await readAuthBody(request))
    if (!input) return authError('Enter a name, valid email, 8–72 character password, and an allowed role.', 400)
    const response = await fetch(getBackendApiEndpoint('/users'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000)
    })
    if (response.status === 409) return authError('This email already has an account. Use “Link existing account” to complete its employee profile.', 409)
    if (response.status === 401) return authError('Your session has expired. Sign in again.', 401)
    if (response.status === 403) return authError('Your account cannot create login accounts.', 403)
    if (response.status === 400 || response.status === 422) return authError('Check the account details and try again.', response.status)
    if (response.status === 429) return authError('Too many requests. Please wait and try again.', 429)
    if (!response.ok) return authError('Account creation could not be confirmed. Check existing accounts before retrying.', 502)
    const payload: unknown = await response.json().catch(() => null)
    let user = null
    if (isRecord(payload) && payload.success === true) user = parseCreatedUser(payload.data)
    if (!user) return authError('Account creation could not be confirmed. Check existing accounts before retrying.', 502)
    return authJson({ success: true, data: user }, 201)
  } catch {
    return authError('The account service is unavailable. If you submitted an account, check existing accounts before retrying.', 503)
  }
}
