export type Role = 'admin' | 'manager' | 'sales' | 'viewer'

export const ROLE_LIST: Role[] = ['admin', 'manager', 'sales', 'viewer']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales Rep',
  viewer: 'Viewer'
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
  manager: ['records:read', 'records:create', 'records:update', 'records:delete'],
  sales: ['records:read', 'records:create', 'records:update'],
  viewer: ['records:read']
}
