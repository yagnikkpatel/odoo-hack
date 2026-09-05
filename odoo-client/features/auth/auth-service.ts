import { ApiError, apiRequest } from '@/lib/api-client'
import type { LoginInput, PasswordResetInput } from './auth-types'

type AuthSuccess = { success: true; message?: string }
async function post(path: string, body: unknown) {
  const result = await apiRequest<AuthSuccess>(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify(body)
  })
  if (result?.success !== true) throw new ApiError('The authentication service returned an unexpected response.', 502)
  return result
}
export function login(input: LoginInput) {
  return post('login', input)
}
export function logout() {
  return post('logout', {})
}
export function requestPasswordReset(input: { email: string }) {
  return post('forgot-password', input)
}
export function verifyPasswordResetOtp(input: { email: string; otp: string }) {
  return post('verify-otp', input)
}
export function resetPassword(input: PasswordResetInput) {
  return post('reset-password', input)
}
