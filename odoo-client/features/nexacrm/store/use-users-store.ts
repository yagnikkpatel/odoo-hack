// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'

type UsersData = {
  users: User[]
  hasHydrated: boolean
}

type UsersActions = {
  initialize: (users: User[]) => void

  /** Patch by id. `id` is excluded because every other record references a user BY it. */
  updateUser: (id: string, patch: Partial<Omit<User, 'id'>>) => void

  deleteUser: (id: string) => void
}

export type UsersStore = UsersData & UsersActions

export const useUsersStore = create<UsersStore>()(set => ({
  users: [],
  hasHydrated: false,
  initialize: users => set({ users, hasHydrated: true }),

  updateUser: (id, patch) =>
    set(state => ({ users: state.users.map(user => (user.id === id ? { ...user, ...patch } : user)) })),

  deleteUser: id => set(state => ({ users: state.users.filter(user => user.id !== id) }))
}))

export const useUser = (id?: string): User | undefined =>
  useUsersStore(state => (id ? state.users.find(user => user.id === id) : undefined))
