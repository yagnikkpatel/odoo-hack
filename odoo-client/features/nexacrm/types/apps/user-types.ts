// Type Imports
import type { Role } from '@/features/nexacrm/types/rbac-types'

export type User = {
  id: string
  name: string
  email: string
  role: Role
  permissions?: readonly string[]

  avatar?: string
}

export const USER_FIELD_LABELS: Partial<Record<keyof User, string>> = {
  name: 'Name',
  email: 'Email',
  role: 'Role',
  avatar: 'Avatar'
}

export const toUserOption = (user: User): { label: string; value: string } => ({ label: user.name, value: user.id })

export const UNASSIGNED_OWNER = 'unassigned'
