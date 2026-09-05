// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'
import type { Permission, Role, RolePermissions } from '@/features/nexacrm/types/rbac-types'

const roleCan = (permissions: RolePermissions, role: Role, permission: Permission): boolean =>
  permissions[role]?.includes(permission) ?? false

export const can = (
  permissions: RolePermissions,
  user: Pick<User, 'role'> | null | undefined,
  permission: Permission
): boolean => (user ? roleCan(permissions, user.role, permission) : false)
