import { isRecord, parseEmail } from '@/features/auth/auth-validation'
import { USER_ROLES } from './types'
import type { CreatedUser, CreateUserInput, UserRole } from './types'

function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.some(role => role === value)
}

export function parseCreateUserInput(value: unknown): CreateUserInput | null {
  if (!isRecord(value)) return null
  if (Object.keys(value).some(key => !['name', 'email', 'password', 'role'].includes(key))) return null
  const email = parseEmail(value.email)
  if (!email || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 120) return null
  if (typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 72) return null
  if (!isUserRole(value.role)) return null
  return { name: value.name.trim(), email, password: value.password, role: value.role }
}

/** Return only public account fields; never forward an upstream password or token. */
export function parseCreatedUser(value: unknown): CreatedUser | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value.id)) return null
  const email = parseEmail(value.email)
  if (!email || typeof value.name !== 'string' || !isUserRole(value.role)) return null
  if (value.status !== 'active' && value.status !== 'inactive') return null
  return { id: value.id, name: value.name, email, role: value.role, status: value.status }
}
