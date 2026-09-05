// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { Permission, Role, RolePermissions } from '@/features/nexacrm/types/rbac-types'
import { ROLE_LIST, ROLE_PERMISSIONS } from '@/features/nexacrm/types/rbac-types'

type RolesData = {
  permissions: RolePermissions
}

type RolesActions = {
  setPermission: (role: Role, permission: Permission, granted: boolean) => void
  resetToDefaults: () => void
}

export type RolesStore = RolesData & RolesActions

const seedPermissions = (): RolePermissions =>
  Object.fromEntries(ROLE_LIST.map(role => [role, [...ROLE_PERMISSIONS[role]]])) as RolePermissions

export const useRolesStore = create<RolesStore>()(set => ({
  permissions: seedPermissions(),

  setPermission: (role, permission, granted) =>
    set(state => {
      const current = state.permissions[role]

      if (current.includes(permission) === granted) return state

      return {
        permissions: {
          ...state.permissions,
          [role]: granted ? [...current, permission] : current.filter(item => item !== permission)
        }
      }
    }),

  resetToDefaults: () => set({ permissions: seedPermissions() })
}))
