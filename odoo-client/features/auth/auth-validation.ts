import { BACKEND_ROLES, type LoginInput, type PasswordResetInput, type SessionUser } from './auth-types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function parseLoginInput(value: unknown): LoginInput | null {
  if (!isRecord(value)) return null
  const email = parseEmail(value.email)
  if (
    !email ||
    typeof value.password !== 'string' ||
    value.password.length < 1 ||
    value.password.length > 1024 ||
    typeof value.rememberMe !== 'boolean'
  )
    return null
  return { email, password: value.password, rememberMe: value.rememberMe }
}

export function parsePasswordResetInput(value: unknown): PasswordResetInput | null {
  if (
    !isRecord(value) ||
    typeof value.newPassword !== 'string' ||
    value.newPassword.length < 8 ||
    value.newPassword.length > 72 ||
    value.confirmPassword !== value.newPassword
  )
    return null
  return { newPassword: value.newPassword, confirmPassword: value.newPassword }
}

export function parseSessionUser(value: unknown): SessionUser | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    value.id.length > 128 ||
    !parseEmail(value.email) ||
    typeof value.role !== 'string' ||
    !BACKEND_ROLES.some(role => role === value.role) ||
    (value.name !== undefined && (typeof value.name !== 'string' || value.name.length > 120))
  )
    return null
  return {
    id: value.id,
    email: value.email as string,
    role: value.role as SessionUser['role'],
    ...(typeof value.name === 'string' ? { name: value.name } : {})
  }
}
