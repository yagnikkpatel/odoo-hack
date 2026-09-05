import type { BackendRole } from '@/features/auth/auth-types'

export type Role = BackendRole

export const ROLE_LIST: Role[] = ['admin', 'employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  employee: 'Employee',
  hr_manager: 'HR Manager',
  hr_payroll_user: 'HR Payroll User',
  hr_payroll_manager: 'HR Payroll Manager'
}

export type Permission =
  | 'records:read'
  | 'records:create'
  | 'records:update'
  | 'records:delete'
  | 'settings:manage'
  | 'members:manage'

export const PERMISSION_LIST: Permission[] = [
  'records:read',
  'records:create',
  'records:update',
  'records:delete',
  'settings:manage',
  'members:manage'
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'records:read': 'View records',
  'records:create': 'Create records',
  'records:update': 'Edit records',
  'records:delete': 'Delete records',
  'settings:manage': 'Manage permissions',
  'members:manage': 'Manage members'
}

/** Role → granted permissions. The shape both the seed constant and the roles store carry. */
export type RolePermissions = Record<Role, Permission[]>

export const ROLE_PERMISSIONS: RolePermissions = {
  admin: [...PERMISSION_LIST],
  hr_manager: ['records:read', 'records:create', 'records:update', 'records:delete'],
  hr_payroll_user: ['records:read', 'records:create', 'records:update', 'records:delete'],
  hr_payroll_manager: ['records:read', 'records:create', 'records:update', 'records:delete'],
  employee: ['records:read']
}
